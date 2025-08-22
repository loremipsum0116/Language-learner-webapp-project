// server/generate-video-3part.mjs

import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) throw new Error('GOOGLE_API_KEY 가 설정되지 않았습니다.');

const MODEL = 'veo-3.0-generate-preview';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'out');
const FINAL_OUTPUT = path.join(OUT_DIR, 'danmusae_ad_concat.mp4');
const SUBBED_OUTPUT = path.join(OUT_DIR, 'danmusae_ad_concat_sub_ko.mp4');
const SRT_PATH = path.join(OUT_DIR, 'captions_ko.srt');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}
function runCapture(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let out = '', err = '';
    p.stdout.on('data', d => (out += d.toString()));
    p.stderr.on('data', d => (err += d.toString()));
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve(out.trim()) : reject(new Error(err || `${cmd} exited ${code}`))));
  });
}

async function ensureFfmpeg() {
  try {
    await run('ffmpeg', ['-version']);
    await run('ffprobe', ['-version']);
  } catch {
    throw new Error('ffmpeg/ffprobe 가 설치되어 있지 않거나 PATH에 없습니다. 설치 후 재시도하세요.');
  }
}

async function startJob(prompt) {
  const res = await fetch(`${BASE_URL}/models/${MODEL}:predictLongRunning`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': API_KEY,
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        aspectRatio: '16:9',
      },
    }),
  });
  if (!res.ok) throw new Error(`[${res.status}] 작업 시작 실패: ${await res.text()}`);
  return res.json();
}

async function poll(operationName) {
  while (true) {
    const res = await fetch(`${BASE_URL}/${operationName}`, {
      headers: { 'x-goog-api-key': API_KEY },
    });
    if (!res.ok) throw new Error(`[${res.status}] 상태 확인 실패: ${await res.text()}`);
    const status = await res.json();
    if (status.done) return status;
    await sleep(10_000);
  }
}

async function downloadWithRedirects(url, maxHops = 5) {
  let current = url;
  for (let i = 0; i < maxHops; i++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { 'x-goog-api-key': API_KEY },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error('리다이렉트 location 없음');
      current = loc;
      continue;
    }
    if (!res.ok) throw new Error(`다운로드 실패 [${res.status}]: ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error('리다이렉트 한도 초과');
}

async function generateClip(prompt, fileBase) {
  console.log(`\n[START] ${fileBase} 생성 요청`);
  const op = await startJob(prompt);
  console.log(`Operation: ${op.name}`);
  const final = await poll(op.name);

  const uri = final?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri) {
    console.error('API 응답에서 video URI를 찾지 못했습니다.');
    console.error(JSON.stringify(final, null, 2));
    throw new Error('URI 없음');
  }

  const rawBuf = await downloadWithRedirects(uri);
  const rawPath = path.join(OUT_DIR, `${fileBase}-raw.mp4`);
  await fs.writeFile(rawPath, rawBuf);
  console.log(`[OK] 원본 저장: ${rawPath}`);

  const normPath = path.join(OUT_DIR, `${fileBase}.mp4`);
  await run('ffmpeg', [
    '-y',
    '-i', rawPath,
    '-r', '24',
    '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264',
    '-c:a', 'aac',
    normPath,
  ]);
  console.log(`[OK] 정규화 저장: ${normPath}`);
  return normPath;
}

async function concatClips(clips, outPath) {
  console.log(`\n[MERGE] ${clips.length}개 클립 결합 → ${outPath}`);
  const args = [
    '-y',
    '-i', clips[0],
    '-i', clips[1],
    '-i', clips[2],
    '-filter_complex',
    '[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]',
    '-map', '[v]',
    '-map', '[a]',
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    outPath,
  ];
  await run('ffmpeg', args);
  console.log('[OK] 결합 완료');
}

async function getDurationSec(filePath) {
  const out = await runCapture('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const n = parseFloat(out);
  if (!isFinite(n)) throw new Error(`ffprobe duration 파싱 실패: ${filePath} (${out})`);
  return n;
}

function toSrtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const hh = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const mm = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const mmm = String(ms % 1000).padStart(3, '0');
  return `${hh}:${mm}:${ss},${mmm}`;
}

async function writeKoreanSubtitles(d1, d2, d3) {
  const m = 0.20;

  const p1aStart = 0 + m;
  const p1aEnd   = Math.min(d1 - m, d1 * 0.60);
  const p1bStart = p1aEnd + 0.05;
  const p1bEnd   = d1 - m;

  const off2 = d1;
  const p2Start = off2 + m;
  const p2End   = off2 + d2 - m;

  const off3 = d1 + d2;
  const p3aStart = off3 + m;
  const p3aEnd   = off3 + Math.min(d3 - m, d3 * 0.55);
  const p3bStart = p3aEnd + 0.05;
  const p3bEnd   = off3 + d3 - m;

  const cues = [
    [1, p1aStart, p1aEnd, '요즘 수능 준비하는데, 영단어가 도무지 머리에 안 들어와.'],
    [2, p1bStart, p1bEnd, '어젯밤에도 수백 번 써봤지만 결국 잉크만 낭비했어.'],
    [3, p2Start,  p2End,  "'단무새'라는 앱을 써봐. 과학적으로 설계된 망각 학습 곡선 스케줄로 단어를 효율적으로 익힐 수 있어."],
    [4, p3aStart, p3aEnd, '맙소사, 한 달에 3,300원? 내 지갑이 살찌겠는걸!'],
    [5, p3bStart, p3bEnd, '단무새와 함께라면, 네 머리는 영어사전이 될 거야!'],
  ];

  let srt = '';
  for (const [idx, s, e, text] of cues) {
    srt += `${idx}\n${toSrtTime(s)} --> ${toSrtTime(e)}\n${text}\n\n`;
  }
  await fs.writeFile(SRT_PATH, srt, 'utf8');
  console.log(`[OK] SRT 저장: ${SRT_PATH}`);
}

async function burnSubtitles(input, srt, output) {
  const vf = `subtitles='${srt.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'")}':force_style='FontName=Malgun Gothic,Fontsize=28,Outline=1,BorderStyle=3,Alignment=2'`;
  await run('ffmpeg', ['-y', '-i', input, '-vf', vf, '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', output]);
  console.log(`[OK] 자막 번인 완료: ${output}`);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await ensureFfmpeg();

  // ===== 공통 캐릭터 고정 =====
  const CONSISTENCY = `
# Character consistency (apply to ALL clips, strong)
- Only TWO Black male leads appear; do NOT change race/skin tone/face/body shape/hairstyle.
- A: Black male, **very heavyset**, shaved head, **completely clean-shaven (NO moustache, NO beard, NO stubble at all)**. Outfit: black hoodie + gray joggers. Prop: left hand holding a cheeseburger (yellow wrapper).
- B: Black male, average build, short curly hair, **noticeable five o'clock shadow (light stubble)**. Outfit: denim jacket + white T-shirt + dark jeans.
- Keep identical looks, outfits, props, and skin tones across all clips.
- Extras are allowed only as unfocused silhouettes; no identifiable faces.
- Time of day: **5 PM (17:00)**. Natural, realistic color grade. 16:9.
- Camera baseline: eye level ±10cm, forward 15°, ~35mm eq., 1/50s; WB/ISO same across clips.
- IMPORTANT: All dialogue MUST be in natural **KOREAN**. Do NOT add on-screen text, captions, signs, or subtitles. Voices should sound natural.
`;

  // ===== 분할 프롬프트 3개 (대사: 한국어, 각 프롬프트에 외형 명시) =====
  const P1 = `
${CONSISTENCY}
# Scene 1/3 — Opening (~7–8s)
A city sidewalk at 5 PM. Two Black men walk side by side; neon signs start to glow, urban ambience in the background.
# Cast look (must match exactly in every scene):
- A (fixed look): Black male, **very heavyset**, shaved head, **completely clean-shaven (no facial hair at all)**; outfit: black hoodie + gray joggers; prop: cheeseburger in left hand (yellow wrapper).
- B (fixed look): Black male, average build, short curly hair, **five o'clock shadow (light stubble)**; outfit: denim jacket + white T-shirt + dark jeans.
A (speaks in KOREAN, slightly frustrated):
"요즘 수능 준비하는데, 영단어가 도무지 머리에 안 들어와. 어젯밤에도 수백 번 써봤지만 결국 잉크만 낭비했어."
# Direction: start on a wide two-shot → slow pan into a medium on A. Subtle handheld. Natural chewing motion, not exaggerated. No on-screen text of any kind.
# Audio: dialogue in KOREAN; gentle street ambience; low BGM.
`;

  const P2 = `
${CONSISTENCY}
# Scene 2/3 — Suggestion (~7–8s)
[Look anchor] Start with the SAME framing/light/exposure as the last frame of Scene 1.
# Cast look (must match exactly):
- A (fixed look): **very heavyset**, shaved head, **completely clean-shaven**; black hoodie + gray joggers; cheeseburger in left hand.
- B (fixed look): average build, short curly hair, **five o'clock shadow**; denim jacket + white T-shirt + dark jeans.
A still holds the burger; B gestures as an idea clicks.
B (speaks in KOREAN, friendly, concise):
"'단무새'라는 앱을 써봐. 과학적으로 설계된 망각 학습 곡선 스케줄로 단어를 효율적으로 익힐 수 있어."
# Direction: close-up on B; soft background bokeh. A nods at frame edge. NO captions or text overlays.
# Audio: KOREAN dialogue; ambience continuity; keep A’s chewing sounds minimal.
`;

  const P3 = `
${CONSISTENCY}
# Scene 3/3 — Resolution (~7–8s)
[Look anchor] Start with the SAME framing/light/exposure as Scene 1’s last frame.
# Cast look (must match exactly):
- A (fixed look): **very heavyset**, shaved head, **completely clean-shaven**; black hoodie + gray joggers; cheeseburger in left hand.
- B (fixed look): average build, short curly hair, **five o'clock shadow**; denim jacket + white T-shirt + dark jeans.
A (checks his phone; delighted) speaks in KOREAN:
"맙소사, 한 달에 3,300원? 내 지갑이 살찌겠는걸!"
B (smiles, in KOREAN):
"단무새와 함께라면, 네 머리는 영어사전이 될 거야!"
# Direction: close-up on A → finish on a two-shot with a subtle sun flare; natural fade out. NO on-screen text.
# Audio: clear KOREAN dialogue; short positive end sting; ambience continuity.
`;

  const clip1 = await generateClip(P1, 'clip1');
  const clip2 = await generateClip(P2, 'clip2');
  const clip3 = await generateClip(P3, 'clip3');

  await concatClips([clip1, clip2, clip3], FINAL_OUTPUT);
  console.log(`\n완료: ${FINAL_OUTPUT}`);

  const d1 = await getDurationSec(clip1);
  const d2 = await getDurationSec(clip2);
  const d3 = await getDurationSec(clip3);
  await writeKoreanSubtitles(d1, d2, d3);
  await burnSubtitles(FINAL_OUTPUT, SRT_PATH, SUBBED_OUTPUT);

  console.log(`\n자막 버전 출력: ${SUBBED_OUTPUT}`);
}

main().catch(err => {
  console.error('파이프라인 오류:', err);
  process.exit(1);
});
