// server/generate-video-3part.mjs
// Node 18+ (global fetch), ffmpeg/ffprobe 필요

import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) throw new Error('GOOGLE_API_KEY 가 설정되지 않았습니다.');

const MODEL_VEO = 'veo-3.0-generate-preview';    // Veo 3 비디오 (8s, 16:9)
const MODEL_IMG = 'imagen-3.0-generate-002';     // 앵커 이미지 생성
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'out');
const FINAL_OUTPUT = path.join(OUT_DIR, 'danmusae_ad_concat.mp4');
const SUBBED_OUTPUT = path.join(OUT_DIR, 'danmusae_ad_concat_sub_ko.mp4');
const SRT_PATH = path.join(OUT_DIR, 'captions_ko.srt');
const ANCHOR_IMG_PATH = path.join(OUT_DIR, 'look_anchor.png');
const REGEN_ANCHOR = process.env.REGEN_ANCHOR === '1';

const ai = new GoogleGenAI({ apiKey: API_KEY });
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 공용 유틸 ---------- */
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
async function ensureOutDir() { await fs.mkdir(OUT_DIR, { recursive: true }); }
async function fileExists(p) { try { await fs.access(p); return true; } catch { return false; } }

/* ---------- MP4 유효성 검사 & 안전 다운로드 ---------- */
async function isLikelyMp4(filePath) {
  try {
    const stat = await fs.stat(filePath);
    if (!stat || stat.size < 100 * 1024) return false; // 100KB 미만은 비정상으로 간주
    const head = await fs.readFile(filePath);
    return head.indexOf(Buffer.from('ftyp')) !== -1;
  } catch {
    return false;
  }
}

// URI 직접 다운로드(리다이렉트/헤더 포함)
async function downloadByUri(uri, outPath, maxHops = 5) {
  let current = uri;
  for (let i = 0; i < maxHops; i++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { 'x-goog-api-key': API_KEY }, // Gemini 파일 링크용
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error('리다이렉트 location 없음');
      current = loc;
      continue;
    }
    if (!res.ok) throw new Error(`다운로드 실패[${res.status}]: ${await res.text()}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(outPath, buf);
    return outPath;
  }
  throw new Error('리다이렉트 한도 초과');
}

// fileRef가 object(name/uri) 또는 string 모두 처리
async function safeDownloadVideo({ fileRef, downloadPath, maxRetries = 3 }) {
  const tmp = downloadPath + '.part';
  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fs.rm(tmp, { force: true });
      await fs.rm(downloadPath, { force: true });

      const name =
        typeof fileRef === 'string'
          ? (fileRef.startsWith('files/') ? fileRef : null)
          : (fileRef?.name || null);
      const uri =
        typeof fileRef === 'string'
          ? (fileRef.startsWith('http') ? fileRef : null)
          : (fileRef?.uri || null);

      if (name) {
        await ai.files.download({ file: name, downloadPath: tmp });
      } else if (uri) {
        await downloadByUri(uri, tmp);
      } else {
        throw new Error('다운로드 참조가 유효하지 않습니다(name/uri 없음).');
      }

      const ok = await isLikelyMp4(tmp);
      if (!ok) throw new Error('Downloaded file is not a valid MP4 (no ftyp or too small)');
      await fs.rename(tmp, downloadPath);
      return downloadPath;
    } catch (e) {
      lastErr = e;
      console.warn(`[download retry ${attempt}/${maxRetries}]`, e.message || e);
      await sleep(1500 * attempt);
    }
  }
  throw lastErr || new Error('Failed to download valid MP4');
}
function assertVideoInOperation(operation, tag = 'op') {
  const videoFile = operation?.response?.generatedVideos?.[0]?.video;
  if (!videoFile) {
    console.error(`[${tag}] No generated video. Full operation:`, JSON.stringify(operation, null, 2));
    throw new Error('Veo returned no video (blocked/safety/quota?).');
  }
  return videoFile;
}

/* ---------- 앵커 이미지 생성(파일) ---------- */
async function generateAnchorImagePNG(outPath) {
  console.log('[ANCHOR] 이미지 생성 시작');
  const prompt = `
High-resolution photorealistic **reference still photo** for a video shoot.
LOCATION: outdoor **city sidewalk/street**, **5 PM (17:00)**, same block for all shots. Natural color grade, eye-level ~35mm, soft bokeh, no text/captions.
CAST (LOCK ACROSS ALL CLIPS):
- A: Black male, **extremely heavyset / obese** (large protruding belly, thick neck and arms), **shaved head**, **completely clean-shaven** (**no moustache, no beard, no stubble**); outfit: black hoodie + gray joggers; **cheeseburger in left hand (yellow wrapper)**.
- B: Black male, average build, short curly hair, **very light five o'clock shadow**; outfit: denim jacket + white T-shirt + dark jeans.
FRAMING: two-shot, head-to-mid-thigh, walking toward camera; storefronts/trees/signs visible for background lock. Use as a **look anchor** for later video generation.
`.trim();

  const resp = await ai.models.generateImages({
    model: MODEL_IMG,
    prompt,
    negativePrompt: 'full beard, thick beard, long beard, moustache, mustache, goatee, heavy sideburns, text overlay, subtitle, signage, watermark, logo'
  });

  const image = resp.generatedImages?.[0]?.image;
  const b64 = image?.imageBytes;
  if (!b64) throw new Error('앵커 이미지 생성 실패(빈 응답).');
  await fs.writeFile(outPath, Buffer.from(b64, 'base64'));
  console.log('[ANCHOR] 저장 완료:', outPath);
  return outPath;
}
async function readFileBase64(p) {
  const buf = await fs.readFile(p);
  return buf.toString('base64');
}

/* ---------- Veo 3 생성 & 폴링 ---------- */
async function startVeoJobAndWait({ prompt, imageBase64 }) {
  let op = await ai.models.generateVideos({
    model: MODEL_VEO,
    prompt,
    image: imageBase64 ? { imageBytes: imageBase64, mimeType: 'image/png' } : undefined, // Image-to-Video
    config: {
      aspectRatio: '16:9',
      // 텍스트/자막 전면 금지 + 수염(전반) 억제
      negativePrompt:
        'interior, indoor, cafe, shop interior, lobby, car interior, extra person, third person, text overlays, captions, subtitle, subs, sub, CC, closed captions, lower-third, lower third, chyron, banner, ticker, speech bubble, bubble text, emoji, letters, words, numbers, on-screen text, typography, sign, signage, jump cut, full beard, thick beard, long beard, moustache, mustache, goatee, heavy sideburns',
      personGeneration: 'allow_adult',
    },
  });
  while (!op.done) {
    await sleep(10_000);
    op = await ai.operations.getVideosOperation({ operation: op });
  }
  return op;
}
async function downloadVideoOp(operation, rawPath) {
  const fileRef = assertVideoInOperation(operation, 'download');
  await safeDownloadVideo({ fileRef, downloadPath: rawPath, maxRetries: 3 });
  return rawPath;
}

/* ---------- 클립 생성(정규화 포함) ---------- */
async function generateClip(prompt, fileBase, imageBase64) {
  console.log(`\n[START] ${fileBase} 생성 요청`);
  const op = await startVeoJobAndWait({ prompt, imageBase64 });

  const rawPath = path.join(OUT_DIR, `${fileBase}-raw.mp4`);
  await downloadVideoOp(op, rawPath);
  console.log(`[OK] 원본 저장: ${rawPath}`);

  const normPath = path.join(OUT_DIR, `${fileBase}.mp4`);
  await run('ffmpeg', [
    '-y', '-i', rawPath,
    '-r', '24', '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264', '-c:a', 'aac',
    normPath,
  ]);
  console.log(`[OK] 정규화 저장: ${normPath}`);
  return normPath;
}

/* ---------- 결합/메타 ---------- */
async function concatClips(clips, outPath) {
  console.log(`\n[MERGE] ${clips.length}개 클립 결합 → ${outPath}`);
  const args = [
    '-y',
    '-i', clips[0], '-i', clips[1], '-i', clips[2],
    '-filter_complex', '[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]',
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart',
    outPath,
  ];
  await run('ffmpeg', args);
  console.log('[OK] 결합 완료');
}
async function getDurationSec(filePath) {
  const out = await runCapture('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
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

/* ---------- SRT(clip1 0–5 추적, 5–8 정지 반영) ---------- */
async function writeKoreanSubtitles(d1, d2, d3) {
  const m = 0.20;

  // clip1: 0–5s 점차 감속 추적, 5–8s 카메라 고정
  const p1aStart = 0 + m;
  const p1aEnd   = Math.min(d1 - m, 5.0 - 0.10); // 첫 대사: 추적 구간
  const p1bStart = p1aEnd + 0.05;
  const p1bEnd   = Math.min(d1 - m, 7.4);        // 두 번째 대사: 정지 초기까지

  // clip2
  const off2 = d1;
  const p2Start = off2 + m;
  const p2End   = off2 + d2 - m;

  // clip3
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

/* ---------- 프롬프트 빌더 ---------- */
function buildConsistencyBlock() {
  return `
# CONSISTENCY (apply to ALL clips, strong)
- Only TWO Black male leads appear; no extra faces; silhouettes only in background. **No third person.**
- TIME: **5 PM (17:00)**. LOCATION: **outdoor city sidewalk/street** only. **NO INTERIORS**.
- **A is EXTREMELY HEAVYSET/OBESE** (large protruding belly, wide torso, thick neck/arms) and **ABSOLUTELY CLEAN-SHAVEN** (**no moustache, no beard, no stubble**). **Shaved head.** Always holds a cheeseburger in the **left** hand (yellow wrapper).
- **B** has short curly hair with **very light** five o'clock shadow (not a moustache/beard).
- Keep identical looks, outfits, props, skin tones across all clips. Lock background composition (storefronts/signs/trees).
- Camera baseline: eye-level ±10cm, forward 15°, ~35mm eq., natural color.
- Dialogue MUST be **KOREAN**. No on-screen text/captions.
`.trim();
}
function buildP1() {
  const CONS = buildConsistencyBlock();
  return `
${CONS}
# Scene 1/3 — Opening (8s, **single continuous shot**)
Two Black men walk side by side on the same sidewalk block at 5 PM.
CAST:
- A: **extremely heavyset/obese**, shaved head, **completely clean-shaven (no moustache, no beard, no stubble)**; black hoodie + gray joggers; cheeseburger (left hand).
- B: average build, short curly hair, **very light** five o'clock shadow; denim jacket + white T-shirt + dark jeans.

# PERFORMANCE (scene 1 only)
- **Only A speaks in KOREAN.** Map the voice to **A (plus-size, shaved head, burger in left hand)**.
- **B is silent** (non-verbal only): small nods/eye contact. **B’s lips remain closed** (no speech articulation).
- **No smiling or laughter** from **both A and B** at any time in this clip, **including the final seconds**.
  A shows mild frustration; B stays neutral/attentive.

# CAMERA CHOREOGRAPHY (critical)
- 0–1s: ease-in to a smooth **backwards tracking** move on gimbal (stabilized).
- **1–8s: keep a continuous, steady backwards dolly** at slow constant speed. **Do not stop, do not lock off.**
- **Both characters keep walking straight forward on the SAME sidewalk lane** (shoulder-to-shoulder). 
  **No splitting, no turning left/right, no diverging paths, no crossing.** Stay in the same block; maintain spacing.

# DIALOGUE (KOREAN):
A (slightly frustrated): "요즘 수능 준비하는데, 영단어가 도무지 머리에 안 들어와. 어젯밤에도 수백 번 써봤지만 결국 잉크만 낭비했어."

# Audio: natural street ambience; subtle BGM; natural chewing (not exaggerated).
`.trim();
}

// FIX(P2): 동일 길거리에서 바로 **B의 MCU(가슴선 위 상반신+얼굴)**로 시작, 너무 타이트 금지, 씬1의 후방 트래킹을 그대로 이어서 진행
function buildP2() {
  const CONS = buildConsistencyBlock();
  return `
${CONS}
# Scene 2/3 — Suggestion (~7–8s)
**Same sidewalk, same block, same light/exposure as Scene 1.** **HARD CUT** to a **medium close shot (MCU) of B** at eye-level — **chest-up framing** that shows **both shoulders and the full face** (do **not** go tighter than MCU). A remains at frame edge as a subtle dirty OTS.

# CAMERA / MOVEMENT (continuity from Scene 1)
- Maintain the **same backward tracking movement and speed** from Scene 1; keep horizon level, no lock-off, no sudden zooms.
- Lens feeling: **~50–65mm** equivalent (natural perspective, not telephoto-tight).
- Keep soft background bokeh; preserve color/WB/ISO match.

# EYE-LINE for B:
- First 60%: looks mostly at **A** (~70%) and briefly toward camera (~30%) with micro eye movements; avoid fixed staring.
- Last 40%: **smoothly transition** gaze to the **camera**, ending with ~0.5–1.0s gentle direct address.

# DIALOGUE (KOREAN):
B (friendly, concise): "'단무새'라는 앱을 써봐. 과학적으로 설계된 망각 학습 곡선 스케줄로 단어를 효율적으로 익힐 수 있어."

# Visual restrictions (hard)
- **ABSOLUTELY NO ON-SCREEN TEXT of any kind** (no subtitles, captions, banners, chyrons, tickers, speech bubbles, emojis, letters, numbers, signage).
# Audio: ambience continuity; A’s chewing minimal.
`.trim();
}

function buildP3() {
  const CONS = buildConsistencyBlock();
  return `
${CONS}
# Scene 3/3 — Resolution (~7–8s)
Same outdoor street; match light/exposure and background lock. Start on a **close-up on A**, then end on a **two-shot** with a subtle sun flare; natural fade out. No text.

# DIALOGUE (KOREAN):
A (checks phone; delighted): "맙소사, 한 달에 3,300원? 내 지갑이 살찌겠는걸!"
B (smiles): "단무새와 함께라면, 네 머리는 영어사전이 될 거야!"

# Audio: clear KOREAN dialogue; short positive end sting; ambience continuity.
`.trim();
}

/* ---------- 엔트리 포인트 ---------- */
async function main() {
  await ensureOutDir();
  await ensureFfmpeg();

  // 1) 앵커 이미지 생성/재사용
  const hasAnchor = await fileExists(ANCHOR_IMG_PATH);
  if (!hasAnchor || REGEN_ANCHOR) {
    await generateAnchorImagePNG(ANCHOR_IMG_PATH);
  } else {
    console.log('[ANCHOR] 기존 파일 재사용:', ANCHOR_IMG_PATH);
  }
  const anchorB64 = await readFileBase64(ANCHOR_IMG_PATH);

  // 2) 씬 프롬프트
  const P1 = buildP1(), P2 = buildP2(), P3 = buildP3();

  // 3) 각 클립 생성(동일 앵커 참조)
  const clip1 = await generateClip(P1, 'clip1', anchorB64);
  const clip2 = await generateClip(P2, 'clip2', anchorB64);
  const clip3 = await generateClip(P3, 'clip3', anchorB64);

  // 4) 결합 + 자막
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
