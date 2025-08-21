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

/** 프로세스 실행(출력 캡처 X) */
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}
/** 프로세스 실행(표준출력 캡처) */
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
      // REST 스키마: instances/parameters
      instances: [{ prompt }],
      parameters: {
        aspectRatio: '16:9',
        // 필요 시: personGeneration, safetySettings 등 추가
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

  // 정규화(24fps, H.264/AAC)
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
  // 타이밍 여유(시작/끝 마진)
  const m = 0.20;

  // P1: 2개 cue
  const p1aStart = 0 + m;
  const p1aEnd   = Math.min(d1 - m, d1 * 0.60);
  const p1bStart = p1aEnd + 0.05;
  const p1bEnd   = d1 - m;

  // P2: 1개 cue
  const off2 = d1;
  const p2Start = off2 + m;
  const p2End   = off2 + d2 - m;

  // P3: 2개 cue
  const off3 = d1 + d2;
  const p3aStart = off3 + m;
  const p3aEnd   = off3 + Math.min(d3 - m, d3 * 0.55);
  const p3bStart = p3aEnd + 0.05;
  const p3bEnd   = off3 + d3 - m;

  const cues = [
    // P1 A (Korean subtitles for English speech)
    [1, p1aStart, p1aEnd,
     '이봐, 요즘 수능 공부 중인데 영단어가 도무지 머리에 안 들어와.'],
    [2, p1bStart, p1bEnd,
     '어젯밤에도 수백 번 써봤지만 결국 잉크만 낭비했어.'],

    // P2 B
    [3, p2Start, p2End,
     '‘단무새’라는 앱을 써봐. 망각곡선 스케줄로 단기간에 많은 단어를 효율적으로 익힐 수 있어.'],

    // P3 A, B
    [4, p3aStart, p3aEnd,
     '정말? 한 달에 3,300원이라니—내 지갑이 살찌겠는데!'],
    [5, p3bStart, p3bEnd,
     '귀여운 단무새가 네 머리를 영어사전으로 만들어 줄 거야, 친구!'],
  ];

  let srt = '';
  for (const [idx, s, e, text] of cues) {
    srt += `${idx}\n${toSrtTime(s)} --> ${toSrtTime(e)}\n${text}\n\n`;
  }
  await fs.writeFile(SRT_PATH, srt, 'utf8');
  console.log(`[OK] SRT 저장: ${SRT_PATH}`);
}

async function burnSubtitles(input, srt, output) {
  // Windows 한글 글꼴 가정(맑은 고딕). 없으면 기본 폰트로 렌더링됩니다.
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
- A: Black male, heavyset, clean-shaven, shaved head. Outfit: black hoodie + gray joggers. Prop: left hand holding a cheeseburger (yellow wrapper).
- B: Black male, average build, short curly hair. Outfit: denim jacket + white T-shirt + dark jeans.
- Keep identical looks, outfits, props, and skin tones across all clips.
- Extras are allowed only as unfocused silhouettes; no identifiable faces.
- Time of day: dusk. Natural, realistic color grade. 16:9.
- Camera baseline: eye level ±10cm, forward 15°, ~35mm eq., 1/50s; WB/ISO same across clips.
- IMPORTANT: All dialogue MUST be in natural ENGLISH. Do NOT add on-screen text, captions, signs, or subtitles. Voices should sound natural.
`;

  // ===== 분할 프롬프트 3개 (영어 대사 + 한국어 자막은 후처리) =====
  const P1 = `
${CONSISTENCY}
# Scene 1/3 — Opening (~7–8s)
A city sidewalk at dusk. Two Black men walk side by side; neon signs start to glow, urban ambience in the background.
A (fixed look): shaved head, heavyset, black hoodie + gray joggers, holding a cheeseburger in his left hand.
B (fixed look): short curly hair, denim jacket + white T-shirt.
A (speaks in ENGLISH, slightly frustrated):
"Man, I've been cramming for the exam, but English vocabulary just won't stick. I wrote them hundreds of times last night and ended up just wasting ink."
# Direction: start on a wide two-shot → slow pan into a medium on A. Subtle handheld. Natural chewing motion, not exaggerated. No on-screen text of any kind.
# Audio: dialogue in ENGLISH; gentle street ambience; low BGM.
`;

  const P2 = `
${CONSISTENCY}
# Scene 2/3 — Suggestion (~7–8s)
[Look anchor] Start with the SAME framing/light/exposure as the last frame of Scene 1. Keep characters, outfits, and tones IDENTICAL.
A still holds the burger; B gestures as an idea clicks.
B (speaks in ENGLISH, friendly, concise):
"Try an app called Danmusae. It uses a scientifically proven forgetting-curve schedule so you can learn a huge number of words efficiently in a short time."
# Direction: close-up on B; soft background bokeh. A nods at frame edge. NO captions or text overlays.
# Audio: ENGLISH dialogue; ambience continuity; keep A’s chewing sounds minimal.
`;

  const P3 = `
${CONSISTENCY}
# Scene 3/3 — Resolution (~7–8s)
[Look anchor] Start with the SAME framing/light/exposure as Scene 1’s last frame. No changes to race/looks/outfits.
A (checks his phone; delighted) speaks in ENGLISH:
"Oh my God—3,300 won per month? My wallet’s going to get fat!"
B (smiles, in ENGLISH):
"Danmusae will give you wings, my friend!"
# Direction: close-up on A → finish on a two-shot with a subtle sun flare; natural fade out. NO on-screen text.
# Audio: clear ENGLISH dialogue; short positive end sting; ambience continuity.
`;

  // ===== 생성 파이프라인 =====
  const clip1 = await generateClip(P1, 'clip1');
  const clip2 = await generateClip(P2, 'clip2');
  const clip3 = await generateClip(P3, 'clip3');

  await concatClips([clip1, clip2, clip3], FINAL_OUTPUT);
  console.log(`\n완료: ${FINAL_OUTPUT}`);

  // ===== 각 클립 길이 측정 → SRT 작성 → 자막 번인 =====
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
