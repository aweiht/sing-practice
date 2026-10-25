import type { Metadata } from "next";
import { codeUrl } from "@/lib/site";

export const metadata: Metadata = { title: "致谢与许可" };

const ROWS: [string, string, string, string][] = [
  ["CREPE（torchcrepe）", "https://github.com/marl/crepe", "学习阶段与实时演唱的音高识别", "MIT"],
  ["GAME（OpenVPI）", "https://github.com/openvpi/GAME", "提取音符", "MIT"],
  ["wav2vec 2.0 base 960h（torchaudio / fairseq）", "https://github.com/facebookresearch/fairseq", "识别演唱时间", "MIT"],
  ["UVR MDX-Net Karaoke 2（Ultimate Vocal Remover）", "https://github.com/Anjok07/ultimatevocalremovergui", "分离主唱", "MIT 条款，致谢 UVR（Anjok07、aufr33）"],
  ["CMU 发音词典", "http://www.speech.cs.cmu.edu/cgi-bin/cmudict", "估算音节数量", "BSD 风格"],
  ["LRCLIB", "https://lrclib.net", "运行时获取同步歌词", "服务"],
  ["ShazamKit（Apple）", "https://developer.apple.com/shazamkit/", "新歌曲识别接口；本版能力未验证", "macOS 组件"],
  ["iTunes Search API（Apple）", "https://performance-partners.apple.com/search-api", "查询专辑封面和歌曲时长", "服务"],
  ["美式英语音节断字规则（hyph-utf8）", "https://github.com/hyphenation/tex-hyphen", "英语歌词音节切分", "宽松许可（Kuiken）"],
  ["ONNX Runtime", "https://onnxruntime.ai", "运行机器学习模型", "MIT"],
  ["Tauri", "https://tauri.app", "桌面应用框架", "MIT / Apache-2.0"],
];

export default function Credits() {
  return (
    <>
      <h1>致谢与许可</h1>
      <p className="lede">随声练改编自 Daniel Murrell 的 <a href="https://github.com/dsmurrell/onkey">dsmurrell/onkey（OnKey）</a>。本项目保留 MIT 许可与上游署名。</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>组件或服务</th><th>用途</th><th>许可</th></tr></thead>
          <tbody>
            {ROWS.map(([name, url, use, lic]) => (
              <tr key={name}><td><a href={url}>{name}</a></td><td>{use}</td><td>{lic}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>随声练遵循 MIT 许可证。第三方组件的完整声明与许可证原文见仓库中的 <a href={codeUrl("THIRD_PARTY_NOTICES.md")}>THIRD_PARTY_NOTICES.md</a> 和 <a href={codeUrl("LICENSE")}>LICENSE</a>。</p>
    </>
  );
}
