//! "Share this take": a short vertical video of a stretch of a take, to post with the song added in Instagram (or
//! TikTok) from its own music library. The voice is the take's microphone recording (raised, nothing else): OnKey
//! adds no music, but a take sung with the song on speakers has some of it in the recording, so the window says
//! headphones are best for sharing. This works out what's drawn (the stretch,
//! the singer's notes and your pitch line in it) and the voice for it; native/share.swift draws and encodes it.
//!
//! The stretch starts on a whole second of the song, so the person can start the song at exactly that second in
//! Instagram's picker (which moves in whole seconds) and their voice lines up.

use std::ffi::CString;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

extern "C" {
    fn onkey_share_render(json: *const std::os::raw::c_char, audio: *const std::os::raw::c_char, out: *const std::os::raw::c_char,
                          icon: *const u8, icon_len: i64) -> i32;
    fn onkey_media_tracks(path: *const std::os::raw::c_char) -> i32;
}

/// How long a clip is (s).
pub const CLIP_S: f64 = 20.0;
/// Shown before and after the playhead in the lane (s), as the app's take page.
const BEFORE_S: f64 = 1.3;
const AFTER_S: f64 = 2.7;
/// The voice is raised by this much, as the take page plays it (dB).
const GAIN_DB: f64 = 7.5;
/// The footer's icon (the app icon, square: rounded when drawn).
const ICON: &[u8] = include_bytes!("../../design/share-icon.png");

/// A take, as far as a clip needs it.
pub struct Take {
    /// song seconds where the take's graph (and recording, less its latency) starts
    pub song_offset: f64,
    /// seconds per frame of `usr`, `err` and the notes
    pub frame_s: f64,
    /// how much later the voice is than the singer, in the recording (s)
    pub latency_s: f64,
    /// the singer's pitch line, your pitch, how far off you were (cents), per frame
    pub reference: Vec<Option<f64>>,
    pub usr: Vec<Option<f64>>,
    pub err: Vec<Option<f64>>,
    /// the singer's notes: start frame, end frame, MIDI note, how much of it you hit (0..1)
    pub notes: Vec<[f64; 4]>,
}

impl Take {
    pub fn from_result(r: &Value) -> Option<Take> {
        let nums = |k: &str| r[k].as_array().map(|a| a.iter().map(|v| v.as_f64()).collect::<Vec<_>>()).unwrap_or_default();
        Some(Take {
            song_offset: r["song_offset"].as_f64()?,
            frame_s: r["frame_s"].as_f64().unwrap_or(0.01),
            latency_s: r["latency_ms"].as_f64().unwrap_or(0.0) / 1000.0,
            reference: nums("ref"),
            usr: nums("usr"),
            err: nums("err"),
            notes: r["notes"].as_array()?.iter().filter_map(|n| {
                let a = n.as_array()?;
                Some([a.first()?.as_f64()?, a.get(1)?.as_f64()?, a.get(2)?.as_f64()?, a.get(3).and_then(|v| v.as_f64()).unwrap_or(0.0)])
            }).collect(),
        })
    }

    /// The take's length on its graph (s).
    fn length(&self) -> f64 {
        self.usr.len().max(self.reference.len()) as f64 * self.frame_s
    }

    /// The song seconds a clip can start at: whole seconds from the take's start to `CLIP_S` before its end (or
    /// the take's first whole second, for a take shorter than a clip).
    fn starts(&self) -> std::ops::RangeInclusive<i64> {
        let first = self.song_offset.ceil() as i64;
        let last = ((self.song_offset + self.length() - CLIP_S).floor() as i64).max(first);
        first..=last
    }

    /// The clip starting at the playhead, `graph_s` into the take: snapped down to a whole second of the song, kept
    /// inside the take.
    pub fn snap(&self, graph_s: f64) -> i64 {
        let r = self.starts();
        ((self.song_offset + graph_s).floor() as i64).clamp(*r.start(), *r.end())
    }

    /// The notes in a clip starting at song second `start`.
    pub fn notes_in(&self, start: i64) -> usize {
        let (g0, g1) = (start as f64 - self.song_offset, start as f64 - self.song_offset + CLIP_S);
        self.notes.iter().filter(|n| (g0..g1).contains(&(n[0] * self.frame_s))).count()
    }

    /// The notes hit in a clip starting at song second `start`.
    pub fn hits(&self, start: i64) -> usize {
        let (g0, g1) = (start as f64 - self.song_offset, start as f64 - self.song_offset + CLIP_S);
        self.notes.iter().filter(|n| n[3] >= 0.5 && (g0..g1).contains(&(n[0] * self.frame_s))).count()
    }

    /// The clip with the most notes hit (the earliest of equals), if any has one.
    pub fn best(&self) -> Option<i64> {
        let mut best: Option<(usize, i64)> = None;
        for s in self.starts() {
            let h = self.hits(s);
            if h > 0 && best.is_none_or(|(bh, _)| h > bh) {
                best = Some((h, s));
            }
        }
        best.map(|(_, s)| s)
    }

    /// The clip's length: `CLIP_S`, or less at the end of a shorter take.
    fn seconds(&self, start: i64) -> f64 {
        CLIP_S.min(self.song_offset + self.length() - start as f64).max(1.0)
    }

    /// What native/share.swift draws, for a clip from song second `start`: times are seconds into the clip.
    pub fn spec(&self, start: i64, title: &str, artist: &str) -> Value {
        let secs = self.seconds(start);
        let g0 = start as f64 - self.song_offset;
        let fs = self.frame_s;
        let notes: Vec<[f64; 4]> = self.notes.iter()
            .filter(|n| n[1] * fs > g0 - BEFORE_S && n[0] * fs < g0 + secs + AFTER_S)
            .map(|n| [n[0] * fs - g0, n[1] * fs - g0, n[2], n[3]]).collect();
        // the pitch range: the clip's notes (an odd far one doesn't squash the rest), 8 semitones at least
        let mut ms: Vec<f64> = self.notes.iter().filter(|n| (g0..g0 + secs).contains(&(n[0] * fs))).map(|n| n[2]).collect();
        ms.sort_by(f64::total_cmp);
        let pct = |p: f64| if ms.is_empty() { 60.0 } else { ms[((ms.len() - 1) as f64 * p).round() as usize] };
        let (mut lo, mut hi) = (pct(0.05) - 2.0, pct(0.95) + 2.0);
        if hi - lo < 8.0 {
            let c = (hi + lo) / 2.0;
            (lo, hi) = (c - 4.0, c + 4.0);
        }
        // your pitch line, in the singer's octave (scoring forgives octaves; the app draws it there too)
        let i0 = ((g0 - BEFORE_S) / fs).floor().max(0.0) as usize;
        let i1 = (((g0 + secs) / fs).ceil() as usize).min(self.usr.len());
        let line: Vec<Value> = (i0..i1).map(|i| {
            let t = i as f64 * fs - g0;
            let m = self.usr[i].map(|u| self.fold(i, u));
            json!([t, m, self.err.get(i).copied().flatten().map(f64::abs)])
        }).collect();
        json!({"title": title, "artist": artist, "footer": "随声练", "seconds": secs, "lo": lo, "hi": hi,
               "step": fs, "notes": notes, "line": line})
    }

    /// `u` (MIDI) moved by octaves next to the singer's line around frame `i` (half a second either way).
    fn fold(&self, i: usize, u: f64) -> f64 {
        let near: Vec<f64> = self.reference[i.saturating_sub(50)..(i + 50).min(self.reference.len())].iter().flatten().copied().collect();
        if near.is_empty() {
            return u;
        }
        let mut s = near.clone();
        s.sort_by(f64::total_cmp);
        let med = s[s.len() / 2];
        u + 12.0 * ((med - u) / 12.0).round()
    }
}

/// "1:05" for song second 65.
pub fn clock(s: i64) -> String {
    format!("{}:{:02}", s / 60, s % 60)
}

/// The voice for a clip: `secs` of the recording from `rec0` (s), raised by `GAIN_DB`, as 16-bit samples.
fn voice(samples: &[f32], rate: f64, rec0: f64, secs: f64) -> Vec<i16> {
    let gain = 10f64.powf(GAIN_DB / 20.0) as f32;
    let a = ((rec0 * rate).round().max(0.0) as usize).min(samples.len());
    let b = (((rec0 + secs) * rate).round().max(0.0) as usize).min(samples.len());
    let mut out: Vec<i16> = samples[a..b].iter().map(|x| ((x * gain).clamp(-1.0, 1.0) * 32767.0) as i16).collect();
    // (silence where the recording didn't reach, so the voice keeps its place)
    let lead = ((-rec0 * rate).round().max(0.0) as usize).min((secs * rate) as usize);
    if lead > 0 {
        out.splice(0..0, std::iter::repeat_n(0, lead));
    }
    out
}

/// A file name for the clip in `dir` that isn't taken: "随声练-<song>-1m05s.mp4", then " 2", " 3"…
fn out_path(dir: &Path, song: &str, start: i64) -> PathBuf {
    let clean: String = song.chars().map(|c| if matches!(c, '/' | ':' | '\\') || c.is_control() { ' ' } else { c }).collect();
    let base = format!("随声练-{}-{}m{:02}s", clean.trim(), start / 60, start % 60);
    (1..).map(|n| dir.join(if n == 1 { format!("{base}.mp4") } else { format!("{base} {n}.mp4") }))
        .find(|p| !p.exists()).unwrap()
}

/// Renders the clip from song second `start` of the take in `take_dir` (its result as `r`) into `dir`: the new
/// file's path.
pub fn render(r: &Value, take_dir: &Path, start: i64, dir: &Path) -> Result<PathBuf, String> {
    let take = Take::from_result(r).ok_or("这段演唱没有可用于剪辑的歌曲位置")?;
    let title = r["track"]["name"].as_str().unwrap_or("");
    let artist = r["track"]["artist"].as_str().unwrap_or("");
    let mic = crate::takeaudio::recording(take_dir).ok_or("这段演唱的录音已不在本机")?;
    let (samples, rate) = crate::takeaudio::decode_mono(&mic).map_err(|e| format!("无法读取这段录音（{e}）"))?;
    let secs = take.seconds(start);
    let rec0 = start as f64 - take.song_offset + take.latency_s;
    std::fs::create_dir_all(dir).map_err(|e| format!("无法创建视频保存目录：{e}"))?;
    let out = out_path(dir, title, start);
    let tmp_audio = dir.join(format!(".onkey-share-{}.m4a", std::process::id()));
    crate::takeaudio::write_m4a(&tmp_audio, &voice(&samples, rate, rec0, secs), rate).map_err(|e| format!("无法写入人声音频（{e}）"))?;
    let spec = CString::new(take.spec(start, title, artist).to_string()).map_err(|e| format!("视频内容包含无效字符：{e}"))?;
    let c = |p: &Path| CString::new(p.to_string_lossy().as_bytes()).map_err(|e| format!("视频路径包含无效字符：{e}"));
    let st = unsafe { onkey_share_render(spec.as_ptr(), c(&tmp_audio)?.as_ptr(), c(&out)?.as_ptr(), ICON.as_ptr(), ICON.len() as i64) };
    let _ = std::fs::remove_file(&tmp_audio);
    if st != 0 {
        let _ = std::fs::remove_file(&out);
        return Err(format!("无法生成视频（步骤 {st}）"));
    }
    Ok(out)
}

/// A movie's tracks: (video, audio), None when it doesn't open (tests).
pub fn tracks(path: &Path) -> Option<(i32, i32)> {
    let c = CString::new(path.to_string_lossy().as_bytes()).ok()?;
    let n = unsafe { onkey_media_tracks(c.as_ptr()) };
    (n >= 0).then_some((n / 10, n % 10))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A take 60 s long starting 10.4 s into the song, at 100 frames a second, with hit notes where asked.
    fn take(hit_at: &[f64]) -> Take {
        let n = 6000;
        Take {
            song_offset: 10.4, frame_s: 0.01, latency_s: 0.2,
            reference: vec![Some(60.0); n], usr: vec![Some(48.2); n], err: vec![Some(20.0); n],
            notes: (0..60).map(|k| {
                let g = k as f64;
                [g * 100.0, g * 100.0 + 50.0, 60.0, if hit_at.iter().any(|h| (g..g + 1.0).contains(h)) { 1.0 } else { 0.2 }]
            }).collect(),
        }
    }

    #[test]
    fn a_clip_starts_on_a_whole_second_of_the_song_inside_the_take() {
        let t = take(&[]);
        assert_eq!(t.snap(5.0), 15, "10.4 + 5.0 = 15.4: down to 15");
        assert_eq!(t.snap(0.0), 11, "the take's first whole second (10 is before it)");
        assert_eq!(t.snap(59.0), 50, "no later than 20 s before the take ends (70.4 - 20 = 50.4)");
    }

    #[test]
    fn the_best_bit_is_the_clip_with_the_most_notes_hit() {
        // hit notes starting at graph 30..35 s: a clip from song 26 (graph 15.6..35.6) is the first to hold all six
        let t = take(&[30.2, 31.2, 32.2, 33.2, 34.2, 35.2, 2.2]);
        assert_eq!(t.best(), Some(26), "the earliest clip with all six");
        assert_eq!(take(&[]).best(), None, "nothing hit: no best bit");
    }

    #[test]
    fn the_voice_is_cut_raised_and_kept_in_place() {
        let s = vec![0.1f32; 1000];
        let v = voice(&s, 100.0, 2.0, 3.0);
        assert_eq!(v.len(), 300);
        assert!((v[0] as f32 / 32767.0 - 0.1 * 2.371).abs() < 0.01, "+7.5 dB is ×2.37");
        let early = voice(&s, 100.0, -0.5, 3.0);
        assert_eq!(early.len(), 300, "half a second of silence before the recording starts");
        assert_eq!(early[0], 0);
    }

    #[test]
    fn the_drawing_has_the_clip_and_the_line_in_the_singers_octave() {
        let t = take(&[30.2]);
        let s = t.spec(40, "Song", "Artist");
        assert_eq!(s["seconds"].as_f64(), Some(20.0));
        let line = s["line"].as_array().unwrap();
        assert!((line[0][0].as_f64().unwrap() + 1.3).abs() < 0.02, "from 1.3 s before the clip");
        assert!((line[0][1].as_f64().unwrap() - 60.2).abs() < 1e-6, "48.2 moved up an octave to the singer's 60");
        assert!(s["hi"].as_f64().unwrap() - s["lo"].as_f64().unwrap() >= 8.0);
    }

    #[test]
    fn a_clip_renders_to_a_video_with_its_voice() {
        // a short take: 3 s long, a tone as the voice, rendered for real (AVFoundation)
        let dir = std::env::temp_dir().join(format!("onkey-share-test-{}", std::process::id()));
        let tdir = dir.join("take");
        std::fs::create_dir_all(&tdir).unwrap();
        let rate = 16000.0;
        let tone: Vec<i16> = (0..(rate as usize * 4)).map(|i| ((i as f64 * 440.0 * std::f64::consts::TAU / rate).sin() * 8000.0) as i16).collect();
        crate::takeaudio::write_m4a(&tdir.join("mic.m4a"), &tone, rate).unwrap();
        let n = 300;
        let r = json!({"song_offset": 0.0, "frame_s": 0.01, "latency_ms": 100, "ref": vec![60.0; n], "usr": vec![59.8; n],
                       "err": vec![20.0; n], "notes": [[20, 120, 60, 1.0], [150, 280, 62, 0.3]],
                       "track": {"name": "Test: Song/One", "artist": "Someone"}});
        let t0 = std::time::Instant::now();
        let out = render(&r, &tdir, 0, &dir).expect("rendered");
        eprintln!("rendered {:.1} s of clip in {:.2} s", Take::from_result(&r).unwrap().seconds(0), t0.elapsed().as_secs_f64());
        assert!(out.file_name().unwrap().to_string_lossy().starts_with("随声练-Test  Song One-0m00s"));
        assert_eq!(tracks(&out), Some((1, 1)), "one video track and one audio track");
        let _ = std::fs::remove_dir_all(&dir);
    }
}

#[cfg(test)]
mod real_take {
    /// Renders a real take's clip (development only): ONKEY_SHARE_TAKE=<take id> ONKEY_SHARE_AT=<song s>
    /// ONKEY_SHARE_OUT=<dir> cargo test --features devtest --lib share::real_take -- --ignored --nocapture
    #[test]
    #[ignore]
    fn render_a_real_take() {
        let id = std::env::var("ONKEY_SHARE_TAKE").expect("ONKEY_SHARE_TAKE");
        let at: i64 = std::env::var("ONKEY_SHARE_AT").ok().and_then(|s| s.parse().ok()).unwrap_or(0);
        let out = std::path::PathBuf::from(std::env::var("ONKEY_SHARE_OUT").expect("ONKEY_SHARE_OUT"));
        let data = std::path::PathBuf::from(std::env::var("HOME").unwrap())
            .join("Library/Application Support/io.github.aweiht.sing-practice/takes").join(&id);
        let mut r: serde_json::Value = serde_json::from_slice(&std::fs::read(data.join("result.json")).unwrap()).unwrap();
        let m: serde_json::Value = serde_json::from_slice(&std::fs::read(data.join("meta.json")).unwrap()).unwrap();
        r["song_offset"] = m["song_offset"].clone();
        let t = std::time::Instant::now();
        let p = super::render(&r, &data, at, &out).unwrap();
        eprintln!("{} in {:.2} s", p.display(), t.elapsed().as_secs_f64());
    }
}
