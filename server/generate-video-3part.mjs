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

const TARGET_CLIP_SEC = 8.0;   // Veo preview 목표 길이
const MIN_CLIP_SEC = 7.8;      // 이보다 짧으면 패딩으로 보정

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

/* ---------- 길이 보정(필요 시 패딩) ---------- */
async function getDurationSec(filePath) {
  const out = await runCapture('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
  ]);
  const n = parseFloat(out);
  if (!isFinite(n)) throw new Error(`ffprobe duration 파싱 실패: ${filePath} (${out})`);
  return n;
}
async function hasAudio(filePath) {
  try {
    const out = await runCapture('ffprobe', [
      '-v', 'error', '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'csv=s=x:p=0', filePath,
    ]);
    return /audio/.test(out);
  } catch {
    return false;
  }
}
async function ensureMinDuration(filePath, minSec = MIN_CLIP_SEC, targetSec = TARGET_CLIP_SEC) {
  const d = await getDurationSec(filePath);
  if (d >= minSec) return filePath;
  const pad = Math.max(0, targetSec - d);
  const tmp = filePath.replace(/\.mp4$/, '-pad.mp4');
  const audio = await hasAudio(filePath);
  if (audio) {
    // 비디오 클론 패드 + 오디오 무음 패드
    await run('ffmpeg', [
      '-y', '-i', filePath,
      '-filter_complex', `[0:v]tpad=stop_mode=clone:stop_duration=${pad}[v];[0:a]apad=pad_dur=${pad}[a]`,
      '-map', '[v]', '-map', '[a]',
      '-c:v', 'libx264', '-c:a', 'aac', '-shortest', tmp,
    ]);
  } else {
    // 오디오 없는 경우: 영상만 패드
    await run('ffmpeg', [
      '-y', '-i', filePath,
      '-vf', `tpad=stop_mode=clone:stop_duration=${pad}`,
      '-c:v', 'libx264', '-an', tmp,
    ]);
  }
  await fs.rename(tmp, filePath);
  console.log(`[LENGTH] ${path.basename(filePath)}: ${d.toFixed(2)}s → >= ${targetSec}s (padded ${pad.toFixed(2)}s)`);
  return filePath;
}

/* ---------- 앵커 이미지 생성(파일) ---------- */
async function generateAnchorImagePNG(outPath) {
  console.log('[ANCHOR] 이미지 생성 시작');
  const prompt = `
High-resolution photorealistic **reference still photo** for a video shoot.
LOCATION: outdoor **city sidewalk/street**, **5 PM (17:00)**, same block for all shots. Natural color grade, eye-level ~35mm, soft bokeh, no text/captions.
CAST (LOCK ACROSS ALL CLIPS):
- A: Black male, **extremely heavyset / obese** (large protruding belly, thick neck and arms), **shaved head**, **completely clean-shaven** (**no moustache, no beard, no stubble**); outfit: black hoodie + gray joggers; **cheeseburger in left hand (white wrapper)**.
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
// clip4에서만 negativePrompt 오버라이드(미소 허용)
async function startVeoJobAndWait({ prompt, imageBase64, negativeOverride }) {
  const defaultNegative =
    'interior, indoor, cafe, shop interior, lobby, car interior, extra person, third person, text overlays, captions, subtitle, subs, sub, CC, closed captions, lower-third, lower third, chyron, banner, ticker, speech bubble, bubble text, emoji, letters, words, numbers, on-screen text, typography, sign, signage, jump cut, full beard, thick beard, long beard, moustache, mustache, goatee, heavy sideburns, smile, smiling, grin, laughter, laugh';

  const negativePrompt = typeof negativeOverride === 'string' ? negativeOverride : defaultNegative;

  let op = await ai.models.generateVideos({
    model: MODEL_VEO,
    prompt,
    image: imageBase64 ? { imageBytes: imageBase64, mimeType: 'image/png' } : undefined,
    config: {
      aspectRatio: '16:9',
      negativePrompt,
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

/* ---------- 클립 생성(정규화 + 길이보정) ---------- */
async function generateClip(prompt, fileBase, imageBase64, opts = {}) {
  console.log(`
[START] ${fileBase} 생성 요청`);
  const op = await startVeoJobAndWait({
    prompt,
    imageBase64,
    negativeOverride: opts.negativeOverride,
  });

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

  await ensureMinDuration(normPath, MIN_CLIP_SEC, TARGET_CLIP_SEC);
  return normPath;
}

/* ---------- 결합/메타 ---------- */
async function concatClips(clips, outPath) {
  console.log(`
[MERGE] ${clips.length}개 클립 결합 → ${outPath}`);
  const args = ['-y'];
  for (const c of clips) args.push('-i', c);
  const inputs = clips.map((_, i) => `[${i}:v][${i}:a]`).join('');
  const filter = `${inputs}concat=n=${clips.length}:v=1:a=1[v][a]`;
  args.push(
    '-filter_complex', filter,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart',
    outPath,
  );
  await run('ffmpeg', args);
  console.log('[OK] 결합 완료');
}
function toSrtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const hh = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const mm = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const mmm = String(ms % 1000).padStart(3, '0');
  return `${hh}:${mm}:${ss},${mmm}`;
}

/* ---------- SRT(clip1 + clip3만) ---------- */
async function writeKoreanSubtitles(d1, d3) {
  const m = 0.20;
  const p1aStart = 0 + m;
  const p1aEnd = Math.min(d1 - m, 3.0);
  const p1bStart = p1aEnd + 0.05;
  const p1bEnd = Math.min(d1 - m, 6.6);
  const off3 = d1;
  const p3Start = off3 + m;
  const p3End = off3 + d3 - m;

  const cues = [
    [1, p1aStart, p1aEnd, '요즘 수능 준비하는데, 영단어가 도무지 머리에 안 들어와.'],
    [2, p1bStart, p1bEnd, '어젯밤에도 수백 번 써봤지만 결국 잉크만 낭비했어.'],
    [3, p3Start, p3End, '레벨별로 세분화된 카테고리와 각종 시험 필수 어휘, 거기에 데일리 리딩, 리스닝, 문법 문제까지! 완전 대박인데!'],
  ];

  let srt = '';
  for (const [idx, s, e, text] of cues) {
    srt += `${idx}
${toSrtTime(s)} --> ${toSrtTime(e)}
${text}

`;
  }
  await fs.writeFile(SRT_PATH, srt, 'utf8');
  console.log(`[OK] SRT 저장: ${SRT_PATH}`);
}
async function burnSubtitles(input, srt, output) {
  function escapeForSubtitlesFilter(p) {
    const abs = path.resolve(p).replace(/\\/g, '/');
    return abs
      .replace(/:/g, '\\:')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/'/g, "\\'");
  }
  const subPath = escapeForSubtitlesFilter(srt);
  const forceStyle = 'FontName=Malgun Gothic,Fontsize=28,Outline=1,BorderStyle=3,Alignment=2';
  const vf = `subtitles='${subPath}':force_style='${forceStyle}'`;
  await run('ffmpeg', ['-y', '-i', input, '-vf', vf, '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', output]);
  console.log(`[OK] 자막 번인 완료: ${output}`);
}


/* ---------- 프롬프트 빌더 ---------- */
function buildConsistencyBlock() {
  return `
# CONSISTENCY (apply to ALL clips, strong)
- Only TWO Black male leads appear; no extra faces; silhouettes only in background. **No third person.**
- TIME: **5 PM (17:00)**. LOCATION: **outdoor city sidewalk/street** only. **NO INTERIORS**.
- **A is EXTREMELY HEAVYSET/OBESE** and **ABSOLUTELY CLEAN-SHAVEN**; shaved head; cheeseburger in **left** hand (white wrapper).
- **B** has short curly hair with **very light** five o'clock shadow.
- Keep identical looks/outfits/props; lock background composition.
- Camera baseline: eye-level; natural color; **24fps ~180° shutter**.
- **Bans:** on-screen text/captions/signage/numbers; black frames; jump cuts; whip pans; rack-focus whiplash; **smile/laughter** (may be overridden per-scene).
`.trim();
}

// 기존 P1/P3 빌더는 유지(사용하지 않음)
function buildP1(){ return buildConsistencyBlock(); }
function buildP3(){ return buildConsistencyBlock(); }

/* ---------- clip4 빌더 (B 클로즈업 시작 → 3초 뒤 와이드, 마지막 B 미소) ---------- */
function buildP4() {
  const CONS = buildConsistencyBlock();
  return `
${CONS}
# Scene — clip4 (target ~8s, **single continuous shot**)

## START FRAME (HARD)
- **Frame 0:** Tight **close-up (CU) on B** at eye level. **B는 첫 프레임부터 아래 한국어 대사를 "그대로" 말하고 있음.** 
  - **절대 의역/추가/삭제 금지.** (문장/어휘/쉼표/억양 지시 포함 원문을 그대로 재현)
  - A는 프레임 밖.

## CAMERA CHOREOGRAPHY
- **0.0–3.0s:** CU on **B** 고정.
- **3.0s부터:** **매우 부드러운 dolly-out(또는 gentle zoom-out)**으로 **A와 B가 함께 보이는 투샷**을 형성.
- **3.0–8.0s:** 안정적 와이드로 전환하면서 두 사람의 시선이 말미에 서로를 잠깐 바라보도록 블로킹.

## PERFORMANCE
- **전 구간 "B만" 발화.** A는 침묵.
- **오버라이드:** 마지막 **약 0.5s**에만 **B의 자연스러운 작은 미소** 허용(그 외 구간 미소 금지).

## DIALOGUE (KOREAN — EXACT, NO PARAPHRASE)
B: "영어 학습이 어렵다고? 단무새와 함께라면, 네 머리는 영어사전이 될 거야."

## DURATION
- 총 길이 **~8.0s**. 5초 컷 금지. 마지막 프레임까지 동작 유지.

## BANS
- 화면 텍스트/자막/사인/숫자 금지. 블랙 프레임/점프컷/휘핑팬 금지. 제3인물 금지.
`.trim();
}

/* ---------- 엔트리 포인트 (clip4만 생성) ---------- */
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

  // clip4 전용: 미소 허용을 위해 smile 금지어 제거
  const NEG_ALLOW_SMILE =
    'interior, indoor, cafe, shop interior, lobby, car interior, extra person, third person, text overlays, captions, subtitle, subs, sub, CC, closed captions, lower-third, lower third, chyron, banner, ticker, speech bubble, bubble text, emoji, letters, words, numbers, on-screen text, typography, sign, signage, jump cut, full beard, thick beard, long beard, moustache, mustache, goatee, heavy sideburns';

  // 2) clip4 프롬프트 준비 및 생성 (clip4 only)
  const P4 = buildP4();
  const clip4 = await generateClip(P4, 'clip4', anchorB64, { negativeOverride: NEG_ALLOW_SMILE });

  // 필요 시 최종 산출물 이름과 동기화
  await fs.copyFile(clip4, FINAL_OUTPUT);

  const d4 = await getDurationSec(clip4);
  console.log(`\n완료: clip4=${clip4} (${d4.toFixed(2)}s)\n`);
}

main().catch(err => {
  console.error('파이프라인 오류:', err);
  process.exit(1);
});
