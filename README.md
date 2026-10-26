# Suisheng Lian (随声练)

[简体中文文档](README.zh-CN.md)

Suisheng Lian is a Chinese-language, open-source Mac singing practice app. It learns a singer's melody from music already playing on the Mac, then displays note bars and your live pitch while you sing. The app does not provide or download music.

This project is adapted from Daniel Murrell's [dsmurrell/onkey (OnKey)](https://github.com/dsmurrell/onkey). The upstream MIT licence and attribution are retained. Third-party model and dependency notices remain in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Current availability

[Download the Apple Silicon preview DMG](https://github.com/aweiht/sing-practice/releases/download/v0.1.0-preview.1/sing-practice-0.1.0-preview.1-macos-arm64.dmg) · [Release notes and checksums](https://github.com/aweiht/sing-practice/releases/tag/v0.1.0-preview.1)

Requires an M1 or later Mac and macOS 14.2 or later. Open the DMG and drag the app to Applications. Learning models are included; no compiler or developer tools are needed to install it.

The preview uses an ad-hoc signature without a Developer ID certificate and is not notarised by Apple. macOS may block the first launch. After checking the source and checksum, follow [Apple's opening guidance](https://support.apple.com/102445). Automatic updates remain disabled, and no website is deployed.

Shazam song recognition is not verified for this version because it has no project-owned Shazam Developer ID. Chinese lyric alignment is also unverified. Do not treat the upstream's English-language measurements as validated performance for this fork.

See [Known issues](docs/KNOWN_ISSUES.md#known-issues) for other documented limitations.

## Build the Mac app from source

The app targets an Apple Silicon Mac (M1 or later) running macOS 14.2 or later. Install Xcode Command Line Tools, Rust, Node.js, and Python 3 first.

```sh
git clone https://github.com/aweiht/sing-practice.git
cd sing-practice
npm ci
npm --prefix ui ci
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements-models.txt
PYTHON=.venv/bin/python scripts/fetch-models.sh
npx tauri build
```

The model-fetch script downloads the required model files and checks their SHA-256 digests. Model files are not stored in Git. Builds use your local toolchain and are not signed or notarised by this project; macOS may block the app on first launch. This source build does not enable automatic updates.

The preview uses models checked against the manifest for SHA-256 and size. Release-mode tests passed (187 tests; 3 recording-related tests ignored). The app's ad-hoc signature and bundled model integrity were checked. Apple notarisation, real-audio operation, hardware compatibility at the minimum supported OS, and the Python model-export route remain unverified.

To build the static website documentation separately:

```sh
npm --prefix site ci
npm --prefix site run build
```

This writes files to `site/out/`; it does not deploy a website.

## Privacy and data

Music audio is analysed in memory and is not saved or uploaded. The app saves learned song information, lyrics, practice scores, diagnostic records, and microphone recordings for playback. A microphone recording may contain some music when you practise through speakers. App data uses the independent directory `~/Library/Application Support/io.github.aweiht.sing-practice/` and does not read or modify OnKey's original data directory.

The app can request synced lyrics from LRCLIB and song or cover information from Apple services. ShazamKit recognition is unverified for this version. Automatic update checks are disabled. The website source has no analytics script.

For bug reports, use [GitHub Issues](https://github.com/aweiht/sing-practice/issues). Issues may be public. Review attachments first; logs may contain song titles. Do not upload recordings, credentials, or other private information.

## Repository layout and maintenance

- `.github/` contains issue forms and repository templates.
- `design/` contains project design materials.
- `docs/` contains contributor and release-history documentation. `docs/RELEASING.md` is an upstream historical reference and must not be executed for this fork.
- `scripts/` contains source-build and project validation helpers.
- `site/` contains the static Chinese landing page and user documentation.
- `src-tauri/` contains the Rust application, native macOS integration, and Tauri configuration.
- `ui/` contains the React desktop interface.

When contributing, keep local build output, downloaded model files, and credentials out of the repository.

## Licence and upstream credit

The project retains the upstream [MIT licence](LICENSE) and attribution to Daniel Murrell / [dsmurrell/onkey](https://github.com/dsmurrell/onkey). Full third-party licence texts are preserved in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). See [LEGAL.md](LEGAL.md) for the current project notice and [site/README.md](site/README.md) for website build instructions.
