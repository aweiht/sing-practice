#!/usr/bin/env python3
"""Generate the Sing Practice geometric pitch icon in every app/site size.

Requires ImageMagick (`magick`) and macOS `iconutil`. It does not use or modify
the upstream OnKey art or the upstream author's portrait.
"""

from __future__ import annotations

import argparse
import json
import plistlib
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SVG_PATH = ROOT / "design" / "sing-practice-icon.svg"
SVG = '''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="36" y="36" width="952" height="952" rx="238" fill="#1B3045"/>
  <circle cx="792" cy="251" r="104" fill="#F8BD64" opacity="0.12"/>
  <path d="M240 782 C323 730 384 742 444 784 S564 825 638 755 S761 664 841 681"
        fill="#1B3045" stroke="#F8BD64" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>
  <circle cx="284" cy="759" r="10" fill="#F8BD64"/>
  <circle cx="326" cy="746" r="10" fill="#F8BD64"/>
  <circle cx="370" cy="751" r="10" fill="#F8BD64"/>
  <circle cx="407" cy="769" r="10" fill="#F8BD64"/>
  <circle cx="484" cy="797" r="10" fill="#F8BD64"/>
  <circle cx="530" cy="809" r="10" fill="#F8BD64"/>
  <circle cx="576" cy="788" r="10" fill="#F8BD64"/>
  <circle cx="671" cy="727" r="10" fill="#F8BD64"/>
  <circle cx="714" cy="695" r="10" fill="#F8BD64"/>
  <circle cx="760" cy="675" r="10" fill="#F8BD64"/>
  <circle cx="807" cy="674" r="10" fill="#F8BD64"/>
  <circle cx="242" cy="782" r="25" fill="#F8BD64"/>
  <circle cx="444" cy="784" r="25" fill="#F8BD64"/>
  <circle cx="638" cy="755" r="25" fill="#F8BD64"/>
  <circle cx="841" cy="681" r="25" fill="#F8BD64"/>
  <rect x="538" y="256" width="46" height="374" rx="23" fill="#F4F5E9"/>
  <rect x="538" y="244" width="238" height="46" rx="23" fill="#F4F5E9"/>
  <ellipse cx="500" cy="641" rx="102" ry="72" fill="#55D3BE"/>
  <path d="M173 434 C209 397 209 341 173 304" fill="#1B3045" stroke="#8BF0D5" stroke-width="24" stroke-linecap="round" opacity="0.82"/>
  <path d="M119 480 C183 416 183 321 119 257" fill="#1B3045" stroke="#8BF0D5" stroke-width="18" stroke-linecap="round" opacity="0.45"/>
</svg>\n'''

PNG_TARGETS: dict[str, int] = {
    "design/app-icon.png": 1024,
    "design/app-icon-square.png": 1024,
    "design/share-icon.png": 512,
    "site/app/icon.png": 1024,
    "site/public/app-icon.png": 512,
    "src-tauri/icons/icon.png": 512,
    "src-tauri/icons/32x32.png": 32,
    "src-tauri/icons/64x64.png": 64,
    "src-tauri/icons/128x128.png": 128,
    "src-tauri/icons/128x128@2x.png": 256,
    "src-tauri/icons/Square30x30Logo.png": 30,
    "src-tauri/icons/Square44x44Logo.png": 44,
    "src-tauri/icons/Square71x71Logo.png": 71,
    "src-tauri/icons/Square89x89Logo.png": 89,
    "src-tauri/icons/Square107x107Logo.png": 107,
    "src-tauri/icons/Square142x142Logo.png": 142,
    "src-tauri/icons/Square150x150Logo.png": 150,
    "src-tauri/icons/Square284x284Logo.png": 284,
    "src-tauri/icons/Square310x310Logo.png": 310,
    "src-tauri/icons/StoreLogo.png": 50,
}
ICO_TARGETS = ("ui/app/favicon.ico", "src-tauri/icons/icon.ico")


def run_checked(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def render_png(magick: str, size: int, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    run_checked([magick, str(SVG_PATH), "-resize", f"{size}x{size}", "-strip", str(target)])


def png_size(path: Path) -> tuple[int, int] | None:
    try:
        with path.open("rb") as stream:
            header = stream.read(24)
        if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
            return None
        return struct.unpack(">II", header[16:24])
    except OSError:
        return None


def make_icns(magick: str, iconutil: str) -> None:
    target = ROOT / "src-tauri/icons/icon.icns"
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="sing-practice-icon-") as temp:
        iconset = Path(temp) / "sing-practice.iconset"
        iconset.mkdir()
        for points in (16, 32, 128, 256, 512):
            render_png(magick, points, iconset / f"icon_{points}x{points}.png")
            render_png(magick, points * 2, iconset / f"icon_{points}x{points}@2x.png")
        run_checked([iconutil, "-c", "icns", "-o", str(target), str(iconset)])


def generate() -> None:
    magick = shutil.which("magick")
    iconutil = shutil.which("iconutil")
    missing = [name for name, path in (("ImageMagick magick", magick), ("macOS iconutil", iconutil)) if not path]
    if missing:
        raise RuntimeError("缺少图标生成工具：" + "、".join(missing))

    SVG_PATH.parent.mkdir(parents=True, exist_ok=True)
    SVG_PATH.write_text(SVG, encoding="utf-8")
    for relative, size in PNG_TARGETS.items():
        render_png(magick, size, ROOT / relative)
    for relative in ICO_TARGETS:
        ico = ROOT / relative
        ico.parent.mkdir(parents=True, exist_ok=True)
        run_checked([magick, str(SVG_PATH), "-define", "icon:auto-resize=256,128,64,48,32,16", str(ico)])
    make_icns(magick, iconutil)
    check()


def check() -> None:
    problems: list[str] = []
    for relative, size in PNG_TARGETS.items():
        actual = png_size(ROOT / relative)
        if actual != (size, size):
            problems.append(f"{relative}: expected {size}x{size}, got {actual}")

    for relative in ICO_TARGETS:
        try:
            data = (ROOT / relative).read_bytes()
            if len(data) < 22 or data[:4] != b"\0\0\1\0" or struct.unpack("<H", data[4:6])[0] < 2:
                problems.append(f"{relative}: invalid or single-size ICO")
        except OSError:
            problems.append(f"{relative}: missing")

    icns = ROOT / "src-tauri/icons/icon.icns"
    try:
        data = icns.read_bytes()
        if len(data) < 12 or data[:4] != b"icns" or struct.unpack(">I", data[4:8])[0] != len(data):
            problems.append("src-tauri/icons/icon.icns: invalid ICNS container")
    except OSError:
        problems.append("src-tauri/icons/icon.icns: missing")

    conf = json.loads((ROOT / "src-tauri/tauri.conf.json").read_text(encoding="utf-8"))
    if conf.get("productName") != "随声练" or conf.get("identifier") != "io.github.aweiht.sing-practice":
        problems.append("tauri.conf.json: productName or identifier does not match the approved brand")
    if "updater" in conf.get("plugins", {}) or "pubkey" in (ROOT / "src-tauri/tauri.conf.json").read_text(encoding="utf-8"):
        problems.append("tauri.conf.json: updater configuration or public key is still present")
    if "tauri-plugin-updater" in (ROOT / "src-tauri/Cargo.toml").read_text(encoding="utf-8"):
        problems.append("Cargo.toml: updater plugin dependency is still present")
    app = (ROOT / "src-tauri/src/lib.rs").read_text(encoding="utf-8")
    if "pub mod updater;" in app or "update_status" in app or "tauri_plugin_updater" in app:
        problems.append("src/lib.rs: executable updater path is still present")
    expected_links = (
        "https://github.com/aweiht/sing-practice",
        "https://github.com/aweiht/sing-practice/issues",
        "https://github.com/dsmurrell/onkey",
    )
    for link in expected_links:
        if link not in app:
            problems.append(f"src/lib.rs: native allowlist is missing {link}")
    if '"version": env!("CARGO_PKG_VERSION")' not in app:
        problems.append("src/lib.rs: visible app version is missing from settings_now")
    for label in ("关于随声练", "报告问题…", "退出随声练", "撤销", "全屏"):
        if label not in app:
            problems.append(f"src/lib.rs: native menu translation is missing {label}")

    plist = plistlib.loads((ROOT / "src-tauri/Info.plist").read_bytes())
    for key in ("NSMicrophoneUsageDescription", "NSAudioCaptureUsageDescription", "NSAppleEventsUsageDescription"):
        if "随声练" not in plist.get(key, ""):
            problems.append(f"Info.plist: {key} is missing its Chinese permission explanation")

    report = (ROOT / "src-tauri/src/report.rs").read_text(encoding="utf-8")
    if "https://github.com/aweiht/sing-practice/issues/new" not in report:
        problems.append("report.rs: issue URL does not use the Sing Practice repository")
    for text in ("随声练当天的运行日志", "这台 Mac 运行过的随声练版本", "问题报告-", "随声练版本信息"):
        if text not in report:
            problems.append(f"report.rs: localized report text is missing {text}")
    if '"footer": "随声练"' not in (ROOT / "src-tauri/src/share.rs").read_text(encoding="utf-8"):
        problems.append("share.rs: exported clip footer does not use the Sing Practice brand")
    listen = (ROOT / "src-tauri/src/listen.rs").read_text(encoding="utf-8")
    if "正在聆听音乐" not in listen or "Shazam 暂不可用" not in listen:
        problems.append("listen.rs: status-line copy is not localized")

    if problems:
        raise RuntimeError("品牌检查未通过：\n- " + "\n- ".join(problems))
    print(f"品牌检查通过：{len(PNG_TARGETS)} 张 PNG、{len(ICO_TARGETS)} 个 ICO、1 个 ICNS 和原生品牌配置。")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="只检查当前品牌产物与原生配置")
    args = parser.parse_args()
    try:
        if args.check:
            check()
        else:
            generate()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
