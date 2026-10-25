pub mod analysis;
pub mod bleed;
pub mod capture;
pub mod ctc;
pub mod beats;
pub mod dsp;
pub mod game;
pub mod devtest;
pub mod discard;
#[cfg(feature = "devtest")]
pub mod mirror;
pub mod engine;
pub mod learn;
pub mod listen;
pub mod lowmem;
pub mod lyrics;
pub mod models;
pub mod lyrics_align;
pub mod mdx;
pub mod music;
pub mod notmusic;
pub mod notes;
pub mod permissions;
pub mod pitch;
pub mod progress;
pub mod recognize;
pub mod records;
pub mod report;
pub mod resample;
pub mod settings;
pub mod share;
pub mod source;
pub mod spotify;
pub mod store;
pub mod syllables;
pub mod take;
pub mod takeaudio;
pub mod timing;
pub mod tracker;
pub mod viz;
pub mod youtube;

use std::sync::{Arc, Mutex};

use serde_json::Value;
use tauri::{Manager, State};

type Shared = Arc<Mutex<engine::Shared>>;

/// The app whose music OnKey follows: in listening mode, the one playing sound (whatever a song's id says).
fn following() -> source::Source {
    if settings::listening() {
        listen::want_bundle().map_or(source::Source::Other, listen::source_of)
    } else {
        source::active()
    }
}

/// In listening mode, a control needs your permission for that app: the answer the window shows instead of
/// doing it (which app, the setting that allows it, and the song, which can be opened there without control).
fn needs_control(app: source::Source, track: Option<&str>) -> Option<Value> {
    if source::controllable(app) {
        return None;
    }
    let (key, name) = source::control_key(app).unwrap_or(("", listen::want_bundle().map_or("your music app", listen::app_name)));
    Some(serde_json::json!({"needs": {"key": key, "app": name, "track": track}}))
}

/// Play, pause, skip or start over, in the music app being followed.
#[tauri::command(async)]
fn player_control(action: String) -> Value {
    let app = following();
    if let Some(n) = needs_control(app, None) {
        return n;
    }
    app.control(&action);
    serde_json::json!({"ok": true})
}

/// The app being listened to now (listening mode), if it's one OnKey knows.
fn running_app() -> Option<source::Source> {
    listen::want_bundle().map(listen::source_of).filter(|s| *s != source::Source::Other)
}

/// Start a track in the app it belongs to (Spotify, Apple Music for songs in your library, or YouTube). A song kept
/// by its ISRC is played by its id in the app it opens in (see `store::pick_app`), when that's known.
#[tauri::command(async)]
fn play_track(id: String, window: tauri::WebviewWindow, store: State<store::Store>) -> Value {
    let mut id = id;
    let mut named = None;
    if source::Source::of_id(&id) == source::Source::Other {
        let (pick, _) = store.open_pick(&id, running_app());
        match pick.id {
            Some(own) => id = own,
            None => named = Some(pick.app),
        }
    }
    let app = source::Source::of_id(&id);
    if let Some(mut n) = needs_control(app, Some(&id)) {
        // no id to play it by: open it in the app it opens in (named in the prompt)
        if let Some(a) = named {
            n["needs"]["app"] = serde_json::json!(a.name());
        }
        return n;
    }
    source::play_track(&id);
    keep_in_front(window, app);
    serde_json::json!({"ok": true})
}

/// Open a song in your music app without controlling it (listening mode, control not allowed; the Library's and
/// Sing page's "in Spotify ↗"): the app it was last played in, by its id there when known (see `store::pick_app`).
/// You press play there; OnKey hears it.
#[tauri::command]
fn open_in_app(id: String, store: State<store::Store>) {
    let (pick, track) = store.open_pick(&id, running_app());
    if pick.app == source::Source::YouTube {
        listen::youtube_used();         // you'll play it in your browser: its sound is listened to for a while
    }
    let _ = std::process::Command::new("open").arg(open_url(&pick, track.as_ref(), music::region().as_deref())).status();
}

/// The app a song opens in ("Spotify", "Apple Music", "YouTube"), for its "in Spotify ↗" link.
#[tauri::command]
fn open_app(id: String, store: State<store::Store>) -> &'static str {
    store.open_pick(&id, running_app()).0.app.name()
}

/// What `open` is given for a pick: Spotify's track (spotify:track:…) or a search there, the YouTube video or a
/// search, the song's Apple Music page or a search there.
fn open_url(pick: &store::Pick, track: Option<&source::Track>, region: Option<&str>) -> String {
    let q = urlencoding::encode(&track.map(|t| format!("{} {}", t.artist, t.name)).unwrap_or_default()).into_owned();
    match (pick.app, &pick.id) {
        (source::Source::Spotify, Some(id)) => id.clone(),
        (source::Source::YouTube, Some(id)) => format!("https://www.youtube.com/watch?v={}", id.strip_prefix(youtube::ID_PREFIX).unwrap_or("")),
        (source::Source::YouTube, None) => format!("https://www.youtube.com/results?search_query={q}"),
        (source::Source::Music, _) => match track.and_then(|t| t.link.as_deref()).and_then(music::apple_music_link) {
            Some(page) => music::apple_music_opens(&page, region)[0].clone(),
            None if q.is_empty() => "music://".to_string(),
            None => format!("music://music.apple.com/search?term={q}"),
        },
        (source::Source::Spotify | source::Source::Other, _) => format!("spotify:search:{q}"),
    }
}

/// Let OnKey control an app from now on (listening mode): "control_spotify", "control_music" or "youtube".
#[tauri::command(async)]
fn allow_control(key: String) {
    match key.as_str() {
        "youtube" => youtube::set_enabled(true),
        "control_spotify" | "control_music" => settings::set(&key, true),
        _ => {}
    }
}

/// Spotify brings itself to the front when told to play a track. For the next few seconds (longer if it
/// had to start), whenever the track's app does, hide it again (it keeps playing) and give OnKey back the focus.
fn keep_in_front(window: tauri::WebviewWindow, app: source::Source) {
    let Some(bundle) = app.app_bundle() else { return };   // YouTube is opened in the background
    std::thread::spawn(move || {
        // checked every 15 ms for the first 2 s (so it's hidden before it has fully appeared), then every 100 ms
        for i in 0..150 {
            std::thread::sleep(std::time::Duration::from_millis(if i < 133 { 15 } else { 100 }));
            let w = window.clone();
            let _ = window.run_on_main_thread(move || {
                let front = objc2_app_kit::NSWorkspace::sharedWorkspace().frontmostApplication();
                if let Some(a) = front.filter(|a| a.bundleIdentifier().is_some_and(|b| b.to_string() == bundle)) {
                    a.hide();
                    let _ = w.set_focus();
                }
            });
        }
    });
}

/// Your own artist and title for a YouTube video whose names were read wrong: shown, and used to find its lyrics.
#[tauri::command]
fn rename_track(id: String, artist: String, name: String) -> Result<(), String> {
    youtube::rename(&id, &artist, &name)
}

#[tauri::command]
fn set_blind(on: bool, shared: State<Shared>) {
    shared.lock().unwrap().blind = on;
}

/// Listening back to a take of a song kept under `id`: the app it plays in, its id there (None: none known, so
/// OnKey can't ask the app to play it), and the id the engine knows it by while it plays (`seen`, what
/// `play_along` is compared with). A song kept by its ISRC (named by Shazam) is played in the app it opens in, by
/// its id there (see `store::pick_app`), as "Sing it again" plays it. `kept`: the id the song is kept under, when
/// it's learned. In listening mode the engine names a learned song by that id whichever app plays it (the app's
/// own id is swapped for it); otherwise it follows the app's own id.
#[derive(Debug, PartialEq)]
struct Along {
    app: source::Source,
    play: Option<String>,
    seen: String,
}

fn along_ids(id: &str, pick: &store::Pick, kept: Option<&str>, listening: bool) -> Along {
    let own = source::Source::of_id(id);
    let (app, play) = if own == source::Source::Other { (pick.app, pick.id.clone()) } else { (own, Some(id.to_string())) };
    let seen = if listening { kept.unwrap_or(id).to_string() } else { play.clone().unwrap_or_else(|| id.to_string()) };
    Along { app, play, seen }
}

fn along_of(id: &str, store: &store::Store) -> Along {
    let (pick, song) = store.open_pick(id, running_app());
    along_ids(id, &pick, song.as_ref().map(|t| t.id.as_str()), settings::listening())
}

/// Listen back to a take with the song: play the track in its app from this position (s) without recording a
/// new take while it plays. `track`: the take's id or the app's own id for it (`along_mode`'s play_id).
#[tauri::command(async)]
fn play_along(track: String, position: f64, shared: State<Shared>, store: State<store::Store>, window: tauri::WebviewWindow) -> Value {
    let along = along_of(&track, &store);
    if let Some(n) = needs_control(along.app, Some(&track)) {
        return n;
    }
    // no id in its app to play it by (along_mode said so: the window joins in instead)
    let Some(play) = along.play else { return serde_json::json!({"ok": false}) };
    {
        let mut sh = shared.lock().unwrap();
        sh.play_along = Some(along.seen);
        // heard once the music app plays it: until then the song that was playing (the app takes a moment to
        // switch) mustn't end the listening back (live: it did, and the requested song became a new take)
        sh.along_heard = false;
    }
    std::thread::spawn(move || {
        let app = along.app;
        // (the app itself says its own id, not the one the song is kept under)
        let now = app.state();
        if now.as_ref().map_or(true, |s| s.track.id != play) {
            source::play_track(&play);
            keep_in_front(window, app);
            std::thread::sleep(std::time::Duration::from_millis(500));
        } else if now.as_ref().is_some_and(|s| !s.playing) {
            app.control("playpause");
        }
        app.seek(position);
    });
    serde_json::json!({"ok": true})
}

/// How "Play with the song" can work for this track: with control of its app (one click: OnKey starts it and
/// goes to the place), or, in listening mode without control, by joining in (you play the song in its app;
/// OnKey hears where it is and plays your recording in step). The app's name, for the window to say which, and
/// `play_id`: the id the app plays it by (the window starts it with that, and knows the player's track by it).
#[tauri::command(async)]
fn along_mode(track: String, store: State<store::Store>) -> Value {
    let along = along_of(&track, &store);
    let name = match along.app {
        source::Source::Other => listen::want_bundle().map_or("your music app", listen::app_name),
        source::Source::YouTube => "your browser",
        a => a.name(),
    };
    // without the song's id in its app, OnKey can't ask the app to play it: allowing control wouldn't help
    let key = along.play.as_ref().and(source::control_key(along.app)).map(|k| k.0);
    serde_json::json!({"control": source::controllable(along.app) && along.play.is_some(), "app": name, "key": key, "play_id": along.play})
}

/// Listening back by joining in (listening mode, no control): no new take while this track plays, and the
/// recording follows the song wherever you play it in its app.
#[tauri::command]
fn join_along(track: String, shared: State<Shared>, store: State<store::Store>) {
    let along = along_of(&track, &store);
    if along.app == source::Source::YouTube {
        listen::youtube_used();
    }
    let mut sh = shared.lock().unwrap();
    sh.play_along = Some(along.seen);
    sh.along_heard = false;
}

/// Stop listening back (the music pauses; plays after this are takes again).
#[tauri::command(async)]
fn stop_play_along(shared: State<Shared>, store: State<store::Store>) {
    let was = shared.lock().unwrap().play_along.take();
    if let Some(track) = was {
        // (it may be the id the song is kept under: its app is the one it was played in)
        let app = along_of(&track, &store).app;
        if source::controllable(app) && app.state().is_some_and(|s| s.playing) {
            app.control("playpause");
        }
    }
}

/// The window is playing one of your takes back (or stopped): while it plays, listening mode doesn't listen to
/// WebKit's sound if OnKey's own can't be told apart from Safari's.
#[tauri::command]
fn take_playing(on: bool) {
    listen::set_take_playing(on);
}

/// Development tools in the window (marked in purple): only in a development build started by `./run`
/// (ONKEY_DEV_TOOLS=1); a release never has them.
#[tauri::command]
fn dev_tools() -> bool {
    cfg!(feature = "devtest") && std::env::var("ONKEY_DEV_TOOLS").is_ok_and(|v| v == "1")
}

/// Development tools: put `text` on the clipboard (a take's link, say).
#[tauri::command]
fn dev_copy(text: String) -> bool {
    dev_tools() && copy_to_clipboard(&text)
}

/// `text` on the clipboard.
fn copy_to_clipboard(text: &str) -> bool {
    use std::io::Write;
    let Ok(mut c) = std::process::Command::new("/usr/bin/pbcopy").stdin(std::process::Stdio::piped()).spawn() else { return false };
    let ok = c.stdin.take().is_some_and(|mut i| i.write_all(text.as_bytes()).is_ok());
    ok && c.wait().is_ok_and(|s| s.success())
}

/// Where the music app is right now: track, playing, position (s, estimated to this moment).
#[tauri::command]
fn player_now(shared: State<Shared>) -> Option<serde_json::Value> {
    let (id, playing, pos, at) = shared.lock().unwrap().player_now.clone()?;
    let p = if playing { pos + at.elapsed().as_secs_f64() } else { pos };
    Some(serde_json::json!({"track": id, "playing": playing, "position": p}))
}

/// What's happening now, for a window that has just loaded (engine::catch_up).
#[tauri::command]
fn catch_up() -> Vec<serde_json::Value> {
    engine::catch_up()
}

/// Score the play now (when the lyrics are over), without waiting for the song to end.
#[tauri::command]
fn finish_take(shared: State<Shared>) {
    shared.lock().unwrap().finish = true;
}

/// Remove the music's sound from the microphone (off: to test with the song playing from speakers).
/// Experimental YouTube support on/off (off by default: it asks to control your browser).
#[tauri::command]
fn set_youtube(on: bool) {
    youtube::set_enabled(on);
}

/// A setting saved across restarts (see settings.rs for the keys).
#[tauri::command]
fn set_setting(key: String, on: bool) {
    if matches!(key.as_str(), "listening" | "control_spotify" | "control_music" | "hide_starters" | "shazam" | "show_lyrics") {
        settings::set(&key, on);
    }
    if key == "battery_30fps" || key == "voice_breaks" {
        settings::set(&key, on);
    }
    // keep the learning models ready between songs (lowmem::keep_learning_models); off: let go of them now
    if key == "keep_models" {
        settings::set(&key, on);
        if !on {
            std::thread::spawn(|| engine::release_learning_models(true));
        }
    }
}

/// The microphones connected, the one OnKey listens to now (setup's mic check and the takes alike), and the one
/// chosen in Settings (null: automatic). Async: listing Core Audio's devices is kept off the window's thread.
#[tauri::command(async)]
fn mics() -> Value {
    serde_json::json!({"devices": capture::mics(), "chosen": capture::chosen_mic(), "preferred": settings::get_str("mic")})
}

/// Listen to this microphone (a uid from `mics`), or automatically (null). The engine moves to it within 3 s.
#[tauri::command(async)]
fn set_mic(uid: Option<String>) {
    let uid = uid.filter(|u| !u.is_empty() && u.len() <= 512);
    capture::set_mic_preference(uid.as_deref().unwrap_or(""));
    settings::set_value("mic", uid.map_or(Value::Null, Value::String));
}

/// The output device now and how its delay is allowed for (timing.rs), and whether the music is playing (the
/// timing check asks for it paused first).
#[tauri::command]
fn output_timing(shared: State<Shared>) -> Value {
    let mut v = timing::status();
    v["music_playing"] = serde_json::json!(shared.lock().unwrap().player_now.as_ref().is_some_and(|p| p.1));
    v
}

/// A timing check of output `uid` done: its clicks, taps and the clocks they're on (timing::Run). Kept and
/// allowed for from now on when believable and confirmed; the result (or what to say) comes back.
#[tauri::command]
fn output_timing_check(uid: String, mut run: timing::Run) -> Value {
    run.clicks.truncate(64);
    run.taps.truncate(256);
    run.kinds.truncate(256);
    run.stamps.truncate(2000);
    run.now.truncate(2000);
    timing::check(&uid, &run)
}

/// Forget output `uid`'s timing check (Core Audio's figure again).
#[tauri::command]
fn output_timing_reset(uid: String) {
    timing::reset(&uid);
}

/// Don't suggest a timing check for output `uid` again.
#[tauri::command]
fn output_timing_dismiss(uid: String) {
    timing::dismiss(&uid);
}

#[tauri::command]
fn settings_now() -> Value {
    serde_json::json!({"version": env!("CARGO_PKG_VERSION"), "listening": settings::listening(), "control_spotify": settings::control("control_spotify"),
        "control_music": settings::control("control_music"), "youtube": youtube::enabled(), "listen_only": settings::listen_only(),
        "hide_starters": settings::get("hide_starters"), "shazam": settings::shazam(), "show_lyrics": settings::show_lyrics(),
        "keep_models": lowmem::keep_learning_models(), "keep_models_default": lowmem::keep_by_default(), "small_mac": lowmem::low_memory(),
        "battery_30fps": settings::get_opt("battery_30fps").unwrap_or(true),
        "voice_breaks": settings::get_opt("voice_breaks").unwrap_or(true)})
}

#[tauri::command]
fn set_echo_cancel(on: bool, shared: State<Shared>) {
    shared.lock().unwrap().echo_cancel = on;
}

/// Jump ahead to just before the singing resumes (song seconds).
#[tauri::command(async)]
fn skip_to(seconds: f64, shared: State<Shared>) -> Value {
    if let Some(n) = needs_control(following(), None) {
        return n;
    }
    shared.lock().unwrap().skip_to = Some(seconds);
    serde_json::json!({"ok": true})
}

/// Forget a learned song (its melody, fingerprint and lyrics). Your takes of it stay in History.
#[tauri::command]
fn delete_take(id: String, store: State<store::Store>) -> bool {
    store.delete_take(&id)
}

#[tauri::command]
fn forget_song(id: String, store: State<store::Store>) {
    store.forget(&id);
    listen::songs_changed();        // (listening mode stops recognising it)
}

/// Stop learning a song and delete it (a learning card's "Stop learning and delete": a video that isn't a song,
/// say). `name` and `artist` find it when it's being kept under another id (its ISRC). See engine::stop_learning.
#[tauri::command]
fn stop_learning(id: String, name: Option<String>, artist: Option<String>, app: tauri::AppHandle, shared: State<Shared>, store: State<store::Store>) {
    let canon = store.canonical(&source::Track { id: id.clone(), name: name.unwrap_or_default(), artist: artist.unwrap_or_default(), ..Default::default() }).id;
    let ids: Vec<String> = if canon != id { vec![id, canon] } else { vec![id] };
    engine::stop_learning(&app, &shared, &store, &ids);
    listen::songs_changed();
}

/// A video OnKey took for talk is a song after all: it's learned the next time it plays.
#[tauri::command]
fn learn_anyway(id: String) {
    discard::undo(&id);
}

/// Heart a song (or take its heart away). `name` and `artist` find the learned song when it's kept under another
/// id (by its ISRC, played from Spotify); a song still being learned gets its heart once it's saved.
#[tauri::command]
fn set_favorite(id: String, favorite: bool, name: Option<String>, artist: Option<String>, store: State<store::Store>) -> bool {
    store.set_favorite(&source::Track { id, name: name.unwrap_or_default(), artist: artist.unwrap_or_default(), ..Default::default() }, favorite)
}

#[tauri::command]
fn is_favorite(id: String, name: Option<String>, artist: Option<String>, store: State<store::Store>) -> bool {
    store.is_favorite(&source::Track { id, name: name.unwrap_or_default(), artist: artist.unwrap_or_default(), ..Default::default() })
}

#[tauri::command]
fn takes(store: State<store::Store>) -> Vec<Value> {
    store.takes()
}

#[tauri::command]
fn library(store: State<store::Store>) -> Vec<Value> {
    store.library()
}

#[tauri::command]
fn take(id: String, store: State<store::Store>) -> Option<Value> {
    store.take_result(&id)
}

/// "Share this take": the clip to make, from the playhead `t` (s into the take, snapped down to a whole second of
/// the song), or with no `t` the take's best bit (the 20 s with the most notes hit). Song seconds: start, end.
#[tauri::command]
fn share_window(id: String, t: Option<f64>, store: State<store::Store>) -> Option<Value> {
    let take = share::Take::from_result(&store.take_result(&id)?)?;
    let start = match t {
        Some(t) => take.snap(t),
        None => take.best()?,
    };
    // (where it is on the take's graph, to show it there; and how it went, so the choice can be seen)
    Some(serde_json::json!({"start": start, "end": start + share::CLIP_S as i64, "at": share::clock(start),
        "to": share::clock(start + share::CLIP_S as i64), "graph": start as f64 - take.song_offset,
        "hits": take.hits(start), "notes": take.notes_in(start)}))
}

/// Makes the share video of take `id` from song second `start` into Downloads, shows it in Finder and puts the
/// song's start time ("0:42") on the clipboard, for Instagram's song picker. The video's path.
#[tauri::command(async)]
fn share_take(id: String, start: i64, store: State<store::Store>) -> Result<Value, String> {
    let r = store.take_result(&id).ok_or("找不到这段演唱")?;
    let dir = store.take_dir(&id).ok_or("找不到这段演唱")?;
    let downloads = std::path::PathBuf::from(std::env::var("HOME").map_err(|_| "无法获取用户目录".to_string())?).join("Downloads");
    let t = std::time::Instant::now();
    let path = share::render(&r, &dir, start, &downloads)?;
    engine::log(&format!("share video of {} from {}: {} in {:.1} s", r["track"]["name"].as_str().unwrap_or("?"),
                         share::clock(start), path.display(), t.elapsed().as_secs_f64()));
    let _ = std::process::Command::new("open").arg("-R").arg(&path).status();
    copy_to_clipboard(&share::clock(start));
    Ok(serde_json::json!({"path": path.to_string_lossy(), "at": share::clock(start)}))
}

/// Where a take's recording is, for the window to play it (through the asset protocol).
#[tauri::command]
fn take_audio(id: String, store: State<store::Store>) -> Option<String> {
    // mic.m4a, or an older take's mic.wav not converted yet (takeaudio.rs); none past the cap (takeaudio::retain)
    takeaudio::recording(&store.take_dir(&id)?).map(|p| p.to_string_lossy().into_owned())
}

/// Open a song's Apple Music page (an Apple cover or a Shazam match links to it) in the Music app, or Spotify's
/// search for it in Spotify.
/// Only those, and Settings' own links (`link_allowed`).
#[tauri::command]
fn open_link(url: String) {
    if link_allowed(&url) {
        // a Spotify link opens the Spotify app, which OnKey hears (open.spotify.com opened the web player in the
        // browser, which it doesn't); the web page only when the app isn't there
        if let Some(app) = music::spotify_app_link(&url) {
            if std::process::Command::new("open").arg(&app).status().is_ok_and(|s| s.success()) {
                return;
            }
        }
        // an Apple Music page opens in the Music app (it opened the website), in the Mac's own store (iTunes Search
        // gives US-store pages); the web page, in that store too, only if the app doesn't open
        if music::apple_music_link(&url).is_some() {
            let [app, web] = music::apple_music_opens(&url, music::region().as_deref());
            if std::process::Command::new("open").arg(&app).status().is_ok_and(|s| s.success()) {
                return;
            }
            let _ = std::process::Command::new("open").arg(web).status();
            return;
        }
        let _ = std::process::Command::new("open").arg(url).status();
    }
}

/// Trusted project links: this repository, its issue tracker, and the upstream source project.
const FIXED_LINKS: [&str; 3] = [
    "https://github.com/aweiht/sing-practice",
    "https://github.com/aweiht/sing-practice/issues",
    "https://github.com/dsmurrell/onkey",
];

/// May `open_link` open this? A song's Apple Music page, a Spotify search or playlist, or one of Settings' own
/// links; nothing with spaces or control characters.
fn link_allowed(url: &str) -> bool {
    let allowed = FIXED_LINKS.contains(&url) || music::apple_music_link(url).is_some() || music::is_spotify_search(url)
        || music::is_spotify_playlist(url);
    allowed && !url.chars().any(|c| c.is_whitespace() || c.is_control())
}

/// A starter song's cover (the "Try these" row): kept in the app's data folder after the first look-up.
#[tauri::command(async)]
fn starter_cover(artist: String, title: String, app: tauri::AppHandle) -> Option<serde_json::Value> {
    let c = music::starter_cover(&app.path().app_data_dir().ok()?, &artist, &title)?;
    Some(serde_json::json!({"art": c.art, "link": c.link}))
}

/// The open-source licences and notices for everything 随声练 ships (THIRD_PARTY_NOTICES.md, a bundle resource).
#[tauri::command]
fn third_party_notices(app: tauri::AppHandle) -> Result<String, String> {
    let path = app.path().resource_dir().map_err(|e| format!("无法获取应用资源目录：{e}"))?.join("THIRD_PARTY_NOTICES.md");
    std::fs::read_to_string(&path).map_err(|e| format!("无法读取第三方许可文件 {}：{e}", path.display()))
}

/// The window's drawing while a song plays (frame intervals, frames dropped, how late updates reach it), every few
/// seconds: into the records (records.rs).
#[tauri::command]
fn perf_frames(report: Value) {
    records::window_frames(&report);
}

/// "报告问题": put 随声练's records together in a folder of their own (report.rs), about a take when given:
/// what's in it, for the window to show before anything is saved.
#[tauri::command(async)]
fn report_prepare(take: Option<String>, app: tauri::AppHandle) -> Result<Value, String> {
    let data = app.path().app_data_dir().map_err(|e| format!("无法获取随声练数据目录：{e}"))?;
    let take = take.filter(|t| store::valid_take_id(t));
    report::prepare(&data, take.as_deref(), 3)
}

/// Save the report prepared, with your description: macOS's save panel (~/Desktop/随声练-问题报告-<date>.zip by
/// default). Where it was saved (with ~ for the home folder), or None if cancelled.
#[tauri::command(async)]
fn report_save(description: String, app: tauri::AppHandle) -> Result<Option<String>, String> {
    let Some(to) = report::ask_where(&app) else { return Ok(None) };
    let to = if to.extension().is_some_and(|x| x == "zip") { to } else { to.with_extension("zip") };
    report::save(&description, &to)?;
    engine::log("report: a problem report was saved");
    let home = std::env::var("HOME").unwrap_or_default();
    let shown = to.to_string_lossy().into_owned();
    Ok(Some(if !home.is_empty() && shown.starts_with(&home) { shown.replacen(&home, "~", 1) } else { shown }))
}

/// The report's files in Finder, to look through before saving.
#[tauri::command(async)]
fn report_open_folder() {
    if let Some(d) = report::staged() {
        let _ = std::process::Command::new("open").arg(d).status();
    }
}

/// The saved report, selected in Finder (`path` as report_save gave it).
#[tauri::command(async)]
fn report_show(path: String) {
    let home = std::env::var("HOME").unwrap_or_default();
    let p = std::path::PathBuf::from(path.replacen('~', &home, 1));
    if p.extension().is_some_and(|x| x == "zip") && p.exists() {
        let _ = std::process::Command::new("open").arg("-R").arg(p).status();
    }
}

/// A new GitHub issue for 随声练 in the browser: the bug report form (.github/ISSUE_TEMPLATE/bug.yml), titled, with
/// this version filled in; the form asks for the zip to be attached (nothing is uploaded).
#[tauri::command(async)]
fn report_issue(take: Option<String>) {
    let b = records::build();
    let title = if take.is_some() { "演唱问题" } else { "问题反馈" };
    let version = format!("{} ({})", b["version"].as_str().unwrap_or("?"), b["sha"].as_str().unwrap_or("?"));
    let url = format!("{}?template=bug.yml&title={}&version={}", report::NEW_ISSUE_URL,
                      urlencoding::encode(title), urlencoding::encode(&version));
    let _ = std::process::Command::new("open").arg(url).status();
}

/// Errors from the window, into the engine's log (so problems in the interface are visible too).
#[tauri::command]
fn ui_log(msg: String) {
    engine::log(&format!("ui: {msg}"));
}

/// The window shows a song playing and can be seen (true), or not (paused, finished, hidden): while you sing a
/// learned song and watch it, learning waits (engine::WINDOW_MOVING).
#[tauri::command]
fn ui_moving(moving: bool) {
    engine::WINDOW_MOVING.store(moving, std::sync::atomic::Ordering::Relaxed);
}

/// Mini mode: a small lyrics bar that floats above every app (and on every desktop), so you can use your Mac
/// while you sing. Off: back to the full window.
#[tauri::command]
fn set_mini(on: bool, window: tauri::WebviewWindow) -> Result<(), String> {
    use tauri::{LogicalPosition, LogicalSize};
    let e = |r: tauri::Result<()>| r.map_err(|e| format!("调整窗口失败：{e}"));
    if on {
        e(window.unmaximize())?;
        e(window.set_min_size(Some(LogicalSize::new(320.0, 80.0))))?;
        e(window.set_size(LogicalSize::new(540.0, 92.0)))?;
        if let Some(m) = window.current_monitor().map_err(|e| format!("读取显示器信息失败：{e}"))? {
            let scale = m.scale_factor();
            let size = m.size().to_logical::<f64>(scale);
            let pos = m.position().to_logical::<f64>(scale);
            e(window.set_position(LogicalPosition::new(pos.x + size.width - 540.0 - 24.0, pos.y + 44.0)))?;
        }
        window_buttons(&window, false)?;        // no window buttons over the lyrics
        e(window.set_shadow(false))?;           // the card draws its own (the window around it is transparent)
        e(window.set_always_on_top(true))?;
        e(window.set_visible_on_all_workspaces(true))?;
    } else {
        window_buttons(&window, true)?;
        e(window.set_shadow(true))?;
        e(window.set_always_on_top(false))?;
        e(window.set_visible_on_all_workspaces(false))?;
        e(window.set_min_size(Some(LogicalSize::new(900.0, 600.0))))?;
        e(window.maximize())?;
    }
    Ok(())
}

/// Show or hide the close/minimise/zoom buttons. Not `set_decorations`: on macOS turning decorations back on
/// resets the window to a standard title bar, dropping the overlay style, and on this transparent window that
/// title bar is see-through (whatever is behind the app shows above it).
fn window_buttons(window: &tauri::WebviewWindow, visible: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let ns = window.ns_window().map_err(|e| format!("获取窗口信息失败：{e}"))? as usize;
        window.run_on_main_thread(move || {
            use objc2_app_kit::{NSWindow, NSWindowButton};
            let ns = unsafe { &*(ns as *const NSWindow) };
            for b in [NSWindowButton::CloseButton, NSWindowButton::MiniaturizeButton, NSWindowButton::ZoomButton] {
                if let Some(button) = ns.standardWindowButton(b) { button.setHidden(!visible); }
            }
        }).map_err(|e| format!("更改窗口按钮失败：{e}"))?;
    }
    #[cfg(not(target_os = "macos"))]
    window.set_decorations(visible).map_err(|e| format!("更改窗口边框失败：{e}"))?;
    Ok(())
}

#[tauri::command(async)]
fn open_privacy_settings() {
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_AudioCapture").status();
}

/// First-run setup: the microphone's and system audio recording's permission, and whether setup was done.
#[tauri::command(async)]
fn setup_status() -> Value {
    permissions::status()
}

#[tauri::command(async)]
fn setup_request(what: String) -> bool {
    if what == "mic" {
        permissions::request_mic();
        true
    } else {
        permissions::request_audio()
    }
}

#[tauri::command(async)]
fn setup_open_settings(what: String) {
    permissions::open_settings(&what);
}

#[tauri::command(async)]
fn setup_meter(on: bool) -> bool {
    permissions::meter(on)
}

#[tauri::command(async)]
fn setup_level() -> f32 {
    permissions::level()
}

/// Setup's music-app step (and Settings' way out of the older way, following the apps by asking them): control of
/// Spotify and Apple Music on (macOS asks for each running one now) or off. Returns setup's status, with each app's permission, and what asking each
/// app answered ("asked": by app, see `permissions::ask_automation`; empty for listen only).
#[tauri::command(async)]
fn setup_control(allow: bool) -> Value {
    let asked = permissions::choose_control(allow);
    let mut st = permissions::status();
    st["asked"] = asked;
    st
}

#[tauri::command(async)]
fn setup_done(done: bool) {
    permissions::set_done(done);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    devtest::init();
    let shared: Shared = Arc::new(Mutex::new(engine::Shared { blind: false, echo_cancel: true, skip_to: None, finish: false, play_along: None, along_heard: false, player_now: None, takes: Vec::new() }));
    tauri::Builder::default()
        .manage(shared.clone())
        // macOS 的系统菜单文案使用简体中文；保留标准编辑、窗口和应用菜单行为。
        .menu(|handle| {
            use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu, HELP_SUBMENU_ID, WINDOW_SUBMENU_ID};

            let about = AboutMetadata {
                name: Some("随声练".to_string()),
                version: Some(handle.package_info().version.to_string()),
                ..Default::default()
            };
            let app_menu = Submenu::with_items(handle, "随声练", true, &[
                &PredefinedMenuItem::about(handle, Some("关于随声练"), Some(about))?,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::services(handle, Some("服务"))?,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::hide(handle, Some("隐藏随声练"))?,
                &PredefinedMenuItem::hide_others(handle, Some("隐藏其他"))?,
                &PredefinedMenuItem::show_all(handle, Some("显示全部"))?,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::quit(handle, Some("退出随声练"))?,
            ])?;
            let file_menu = Submenu::with_items(handle, "文件", true, &[
                &PredefinedMenuItem::close_window(handle, Some("关闭窗口"))?,
            ])?;
            let edit_menu = Submenu::with_items(handle, "编辑", true, &[
                &PredefinedMenuItem::undo(handle, Some("撤销"))?,
                &PredefinedMenuItem::redo(handle, Some("重做"))?,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::cut(handle, Some("剪切"))?,
                &PredefinedMenuItem::copy(handle, Some("拷贝"))?,
                &PredefinedMenuItem::paste(handle, Some("粘贴"))?,
                &PredefinedMenuItem::select_all(handle, Some("全选"))?,
            ])?;
            let view_menu = Submenu::with_items(handle, "显示", true, &[
                &PredefinedMenuItem::fullscreen(handle, Some("进入全屏"))?,
            ])?;
            let window_menu = Submenu::with_id_and_items(handle, WINDOW_SUBMENU_ID, "窗口", true, &[
                &PredefinedMenuItem::minimize(handle, Some("最小化"))?,
                &PredefinedMenuItem::maximize(handle, Some("缩放"))?,
                &PredefinedMenuItem::separator(handle)?,
                &PredefinedMenuItem::close_window(handle, Some("关闭窗口"))?,
            ])?;
            let help_menu = Submenu::with_id_and_items(handle, HELP_SUBMENU_ID, "帮助", true, &[
                &MenuItem::with_id(handle, "report", "报告问题…", true, None::<&str>)?,
            ])?;
            Menu::with_items(handle, &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])
        })
        .on_menu_event(|app, ev| {
            if ev.id() == "report" {
                use tauri::Emitter;
                let _ = app.emit("onkey-menu", "report");
            }
        })
        .invoke_handler(tauri::generate_handler![catch_up, player_control, play_track, set_blind, takes, library, take, take_audio, share_window, share_take, open_privacy_settings, ui_log, ui_moving, skip_to, set_mini, forget_song, stop_learning, learn_anyway, delete_take, set_echo_cancel, set_youtube, set_setting, settings_now, allow_control, open_in_app, along_mode, join_along, finish_take, play_along, stop_play_along, player_now, dev_tools, dev_copy, rename_track, take_playing,
            setup_status, setup_request, setup_open_settings, setup_meter, setup_level, setup_done, setup_control, third_party_notices, perf_frames, report_prepare, report_save, report_open_folder, report_show, report_issue, open_link, starter_cover, set_favorite, is_favorite, open_app, mics, set_mic, output_timing, output_timing_check, output_timing_reset, output_timing_dismiss,
            ])
        .setup(move |app| {
            // the records first: this log session starts with the build and the Mac (records.rs)
            records::init(&app.path().app_data_dir()?);
            // the takes' recordings saved as WAV before AAC: converted once, in the background, while idle
            takeaudio::start(app.path().app_data_dir()?);
            let store = store::Store::new(app.path().app_data_dir()?);
            app.manage(store.clone());
            // the settings first: YouTube's switch is one of them
            settings::init(&app.path().app_data_dir()?);
            capture::set_mic_preference(&settings::get_str("mic").unwrap_or_default());
            youtube::set_data_dir(&app.path().app_data_dir()?);
            discard::set_data_dir(&app.path().app_data_dir()?);
            lyrics::set_cache_dir(&app.path().app_data_dir()?);
            // the models compiled for Core ML, kept for good (compiled once, not again after a temp-folder clean)
            pitch::set_coreml_cache_dir(&app.path().app_data_dir()?);
            // songs kept twice (learned under two ids before songs were kept under one) become one, once
            let merged = store.merge_duplicates();
            if merged > 0 {
                engine::log(&format!("library: {merged} song{} kept twice merged", if merged == 1 { "" } else { "s" }));
            }
            // a podcast episode (or an ad) learned as if it were a song, before they were told apart: to the Trash
            for t in store.learned_tracks().into_iter().filter(|t| !source::is_song(&t.id)) {
                engine::log(&format!("library: {} ({}) isn't a song: removed (to the Trash)", t.name, t.id));
                store.forget(&t.id);
            }
            // the apps' ids and the app played in, for songs learned before they were kept (once each)
            let filled = store.backfill_sources();
            if filled > 0 {
                engine::log(&format!("library: where {filled} song{} played found from History", if filled == 1 { "" } else { "s" }));
            }
            listen::init(store.clone());
            {
                let store = store.clone();
                std::thread::spawn(move || store.find_missing_covers());
            }
            // learning needs the separator, CREPE-full and the word timer, which ship inside the app (and only
            // there); if the set isn't whole (a damaged install), learned songs can be sung but new ones aren't
            // learned, and the window says so (models::state, in the engine's status)
            let bundled = app.path().resource_dir()?.join("models");
            let model_dir = match models::check(&bundled) {
                Ok(()) => Some(bundled),
                Err(e) => {
                    engine::log(&format!("learning models: {e}"));
                    models::set_state(serde_json::json!({"state": "missing", "error": e}));
                    None
                }
            };
            *engine::WORD_MODEL.lock().unwrap() = model_dir.as_ref().map(|d| d.join("wav2vec2-base-960h-fp16.onnx"));
            // the models load on the learner's own thread (seconds): a new take starts at once
            let learners: engine::LearnerFactory = Arc::new(move |rate| {
                let models = model_dir.clone()?;
                Some(learn::Learner::start_with(Box::new(move || {
                    let sep = mdx::Mdx::load(&models.join("UVR_MDXNET_KARA_2.onnx"), 4, crate::devtest::knob!("ONKEY_CPU").is_none())
                        .inspect_err(|e| engine::log(&format!("learner: the separation model couldn't be loaded: {e}")))?;
                    let pitch = pitch::Crepe::from_file(&models.join("crepe-full-b32.onnx"), 2, Some(32))
                        .map_err(|e| e.to_string())
                        .inspect_err(|e| engine::log(&format!("learner: the pitch model couldn't be loaded: {e}")))?;
                    Ok((Box::new(sep) as Box<dyn learn::Separator>, Box::new(pitch) as Box<dyn learn::VocalPitch>))
                }), rate))
            });
            #[cfg(feature = "devtest")]
            mirror::start(app.handle().clone(), store.clone());
            engine::keep_learned_lyrics(store.clone());
            engine::spawn(app.handle().clone(), shared.clone(), store, learners);
            on_terminate();
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("随声练启动失败")
        .run(|app, event| match event {
            // quitting (from the menu, or the last window closed): OnKey looks gone at once (windows and Dock icon),
            // and finishes learning the song playing and any still waiting in the background before it exits.
            // Songs learn one at a time, so waiting 25 s lost a song queued behind another (Galway Girl, 19 Oct)
            tauri::RunEvent::ExitRequested { api, .. } if !engine::quitting() => {
                api.prevent_exit();
                use tauri::Manager;
                for w in app.webview_windows().values() {
                    let _ = w.hide();
                }
                #[cfg(target_os = "macos")]
                let _ = app.set_dock_visibility(false);
                std::thread::spawn(|| {
                    engine::shutdown(QUIT_LEARN_WAIT);
                    relaunch_if_asked();
                    std::process::exit(0);
                });
            }
            // ⌘Q again (or the last window closed) while it finishes out of sight: the quit going on exits when done.
            // An exit requested while shutdown finishes is ignored; a new launch is handled by Reopen below.
            tauri::RunEvent::ExitRequested { api, code: None, .. } => {
                api.prevent_exit();
            }
            // opened again while it finishes out of sight: macOS hands the open to this quitting copy, so it
            // starts a fresh one as it exits (else nothing would appear)
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen { .. } if engine::quitting() => {
                RELAUNCH.store(true, std::sync::atomic::Ordering::SeqCst);
                engine::log("quitting: opened again meanwhile, so it starts afresh when done");
            }
            tauri::RunEvent::Exit => {
                engine::shutdown(QUIT_WAIT);
            }
            _ => {}
        });
}

/// How long a quit waits for the song playing (and any still finishing) to be learned and saved when it has to be quick.
const QUIT_WAIT: std::time::Duration = std::time::Duration::from_secs(25);

static RELAUNCH: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// OnKey was opened again while quitting: open a new copy of the app (a second after this one has gone).
fn relaunch_if_asked() {
    if !RELAUNCH.load(std::sync::atomic::Ordering::SeqCst) {
        return;
    }
    // .../OnKey.app/Contents/MacOS/onkey -> .../OnKey.app
    if let Some(bundle) = std::env::current_exe().ok().and_then(|e| e.ancestors().nth(3).map(|p| p.to_path_buf())) {
        let _ = std::process::Command::new("/bin/sh").arg("-c").arg("sleep 1; /usr/bin/open -n \"$0\"").arg(&bundle).spawn();
    }
}

/// How long a quit from the menu waits, out of sight, for every song being learned or waiting to be (each takes
/// up to a minute or so, and they all finish together once quitting).
const QUIT_LEARN_WAIT: std::time::Duration = std::time::Duration::from_secs(150);

/// Told to stop (SIGTERM: `kill`, `./run` restarting it, logging out): quit as from the menu, keeping what's been
/// learned, rather than at once.
fn on_terminate() {
    static TERM: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
    extern "C" fn handler(_: libc::c_int) {
        TERM.store(true, std::sync::atomic::Ordering::SeqCst);      // (all a signal handler may safely do)
    }
    unsafe {
        libc::signal(libc::SIGTERM, handler as *const () as libc::sighandler_t);
    }
    std::thread::spawn(|| {
        while !TERM.load(std::sync::atomic::Ordering::SeqCst) {
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        engine::log("told to stop (SIGTERM)");
        engine::shutdown(QUIT_WAIT);
        std::process::exit(0);
    });
}

#[cfg(test)]
mod tests {
    #[test]
    fn settings_links_open_only_exactly_as_given() {
        assert!(super::link_allowed("https://github.com/aweiht/sing-practice"));
        assert!(super::link_allowed("https://github.com/aweiht/sing-practice/issues"));
        assert!(super::link_allowed("https://github.com/dsmurrell/onkey"));
        assert!(!super::link_allowed("https://github.com/aweiht/sing-practice.evil.example"));
        assert!(!super::link_allowed("https://github.com/aweiht/sing-practice/issues --args"));
    }

    use super::*;
    use source::{Source, Track};
    use store::Pick;

    #[test]
    fn a_song_opens_by_its_id_or_a_search_in_its_app() {
        let t = Track { id: "isrc:USSM10603618".into(), name: "How to Save a Life".into(), artist: "The Fray".into(), ..Default::default() };
        let pick = |app, id: Option<&str>| Pick { app, id: id.map(String::from) };
        assert_eq!(open_url(&pick(Source::Spotify, Some("spotify:track:5fVZC9GiM4e8vu99W0Xf6J")), Some(&t), None), "spotify:track:5fVZC9GiM4e8vu99W0Xf6J");
        assert_eq!(open_url(&pick(Source::Spotify, None), Some(&t), None), "spotify:search:The%20Fray%20How%20to%20Save%20a%20Life");
        assert_eq!(open_url(&pick(Source::YouTube, Some("youtube:abc")), Some(&t), None), "https://www.youtube.com/watch?v=abc");
        assert_eq!(open_url(&pick(Source::Music, None), Some(&t), Some("gb")), "music://music.apple.com/search?term=The%20Fray%20How%20to%20Save%20a%20Life");
        let linked = Track { link: Some("https://music.apple.com/us/album/x/1?i=2".into()), ..t.clone() };
        assert_eq!(open_url(&pick(Source::Music, Some("music:ABC")), Some(&linked), Some("gb")), "music://music.apple.com/gb/album/x/1?i=2",
                   "in the Music app, in the Mac's own store");
        assert_eq!(open_url(&pick(Source::Music, Some("music:ABC")), Some(&linked), None), "music://music.apple.com/us/album/x/1?i=2");
    }

    #[test]
    fn a_take_kept_by_its_isrc_plays_along_by_its_id_in_its_app() {
        let pick = |app, id: Option<&str>| Pick { app, id: id.map(String::from) };
        let isrc = "isrc:USWB19900123";
        let sp = "spotify:track:1TfqLAPs4K3s2rJMoCokcS";
        // kept by its ISRC, last played in Spotify: Spotify plays it by its own id; listening mode follows the song
        // by the id it's kept under, outside listening mode by Spotify's
        let a = along_ids(isrc, &pick(Source::Spotify, Some(sp)), Some(isrc), true);
        assert_eq!(a, Along { app: Source::Spotify, play: Some(sp.into()), seen: isrc.into() });
        assert_eq!(along_ids(isrc, &pick(Source::Spotify, Some(sp)), Some(isrc), false).seen, sp);
        // the window passes the app's id back (play_along): the same answer
        assert_eq!(along_ids(sp, &pick(Source::Spotify, Some(sp)), Some(isrc), true), a);
        // no id in its app: nothing to ask the app to play
        let none = along_ids(isrc, &pick(Source::Spotify, None), Some(isrc), true);
        assert_eq!(none, Along { app: Source::Spotify, play: None, seen: isrc.into() });
        // a song kept under the app's own id is played by it, in its own app (whatever the pick says)
        assert_eq!(along_ids("music:42", &pick(Source::Spotify, Some(sp)), Some("music:42"), true),
                   Along { app: Source::Music, play: Some("music:42".into()), seen: "music:42".into() });
        // not learned yet: listening mode doesn't rename it, the engine follows the app's id
        assert_eq!(along_ids(sp, &pick(Source::Spotify, Some(sp)), None, true).seen, sp);
    }
}
