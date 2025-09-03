// server/mona-6sec.mjs
// 요구: ffmpeg/ffprobe 설치, npm i @google/genai @google-cloud/text-to-speech
// 환경변수: GOOGLE_API_KEY, GOOGLE_APPLICATION_CREDENTIALS

import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { GoogleGenAI } from '@google/genai';
import textToSpeech from '@google-cloud/text-to-speech';

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) throw new Error('GOOGLE_API_KEY 가 설정되지 않았습니다.');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'out');
const ANCHOR_IMG_PATH = path.join(OUT_DIR, 'look_anchor.png'); // 모나리자 이미지(이미 존재)
const RAW_VIDEO = path.join(OUT_DIR, 'mona_raw.mp4');
const NORM_VIDEO = path.join(OUT_DIR, 'mona_norm.mp4');
const FINAL_AUDIO = path.join(OUT_DIR, 'mona_voice_6s.wav');
const FINAL_OUTPUT = path.join(OUT_DIR, 'mona_6s.mp4');

const TARGET_SEC = 6.0;

const ai = new GoogleGenAI({ apiKey: API_KEY });
const ttsClient = new textToSpeech.TextToSpeechClient();
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 공용 유틸 ---------- */
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}
async function runCapture(cmd, args, opts = {}) {
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
    throw new Error('ffmpeg/ffprobe 가 필요합니다. 설치 후 재시도하세요.');
  }
}
async function ensureOutDir() { await fs.mkdir(OUT_DIR, { recursive: true }); }
async function fileExists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function readFileBase64(p) { const b = await fs.readFile(p); return b.toString('base64'); }
async function getDurationSec(filePath) {
  const out = await runCapture('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
  ]);
  const n = parseFloat(out);
  if (!isFinite(n)) throw new Error(`ffprobe duration 파싱 실패: ${filePath} (${out})`);
  return n;
}

/* ---------- 안전 다운로드 유틸 (files/… 또는 URI 모두 지원) ---------- */
async function isLikelyMp4(filePath) {
  try {
    const stat = await fs.stat(filePath);
    if (!stat || stat.size < 100 * 1024) return false;
    const head = await fs.readFile(filePath);
    return head.indexOf(Buffer.from('ftyp')) !== -1;
  } catch {
    return false;
  }
}
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

/* ---------- Veo 3 비디오 생성 ---------- */
async function generateMonaVideo(anchorB64) {
  const MODEL_VEO = 'veo-3.0-generate-preview';

  const prompt = `
# GOAL
A 6-second single shot video. Use the given anchor image (Mona Lisa) as the subject.
No text on screen. One continuous take, locked framing (bust/shoulders-up). Natural museum-like lighting.
Subtle micro head/eye movements. **Mouth articulates as if speaking the Korean line**.
Keep the original painting's style respectful and realistic.

# CAMERA
- Framing: bust/shoulders-up, straight-on, eye-level.
- Duration: **about 6 seconds** (single shot).
- No cuts, no transitions, no zooms.

# AUDIO (model-side)
- If your model generates audio, **Korean female voice** only, speaking the line below. No music/SFX.
- Otherwise, keep silent; external TTS will be muxed.

# DIALOGUE (KOREAN — EXACT)
"영단어를 노트에 수백 번 써 봤지만, 아까운 잉크만 낭비했다구요?"

# BANS
- No on-screen text/captions/subtitles/signage/numbers/logos.
- No extra characters.
- No flicker, no heavy distortions, no mouth sync drift spikes.
`.trim();

  const negativePrompt =
    'text overlays, captions, subtitle, subs, CC, signage, logo, numbers, extra person, shaky cam, whip pan, jump cut, heavy distortion';

  let op = await ai.models.generateVideos({
    model: MODEL_VEO,
    prompt,
    image: anchorB64 ? { imageBytes: anchorB64, mimeType: 'image/png' } : undefined,
    config: {
      aspectRatio: '16:9',
      negativePrompt,
      personGeneration: 'allow_adult',
    },
  });

  while (!op.done) {
    await sleep(8000);
    op = await ai.operations.getVideosOperation({ operation: op });
  }

  const fileRef = op?.response?.generatedVideos?.[0]?.video;
  if (!fileRef) {
    console.error('Veo 응답:', JSON.stringify(op, null, 2));
    throw new Error('Veo가 비디오를 반환하지 않았습니다.');
  }

  // ★ 리소스/URI 모두 대응
  await safeDownloadVideo({ fileRef, downloadPath: RAW_VIDEO, maxRetries: 3 });

  // 정규화(24fps, 픽셀포맷), 오디오 제거(외부 TTS로 대체)
  await run('ffmpeg', [
    '-y', '-i', RAW_VIDEO,
    '-r', '24', '-pix_fmt', 'yuv420p',
    '-an',
    '-c:v', 'libx264',
    NORM_VIDEO,
  ]);

  // 길이 보정: 부족 시 클론패드, 초과 시 트림
  const d = await getDurationSec(NORM_VIDEO);
  if (Math.abs(d - TARGET_SEC) < 0.05) return NORM_VIDEO;

  const tmpOut = NORM_VIDEO.replace(/\.mp4$/, '-lenfix.mp4');
  if (d < TARGET_SEC) {
    const pad = (TARGET_SEC - d).toFixed(3);
    await run('ffmpeg', [
      '-y', '-i', NORM_VIDEO,
      '-vf', `tpad=stop_mode=clone:stop_duration=${pad}`,
      '-c:v', 'libx264', '-an', tmpOut,
    ]);
  } else {
    await run('ffmpeg', [
      '-y', '-i', NORM_VIDEO,
      '-t', TARGET_SEC.toString(),
      '-c:v', 'libx264', '-an', tmpOut,
    ]);
  }
  await fs.rename(tmpOut, NORM_VIDEO);
  return NORM_VIDEO;
}

/* ---------- TTS(ko-KR, 여성) + 6초 길이 강제 ---------- */
async function synthesizeKoreanFemale(line) {
  const req = {
    input: { text: line },
    voice: {
      languageCode: 'ko-KR',
      name: 'ko-KR-Neural2-A',
      ssmlGender: 'FEMALE',
    },
    audioConfig: {
      audioEncoding: 'LINEAR16',
      speakingRate: 1.0,
      pitch: 0.0,
      sampleRateHertz: 48000,
    },
  };
  const [resp] = await ttsClient.synthesizeSpeech(req);
  const wavPath = path.join(OUT_DIR, 'mona_voice_raw.wav');
  await fs.writeFile(wavPath, resp.audioContent);

  // 6초로 패딩/트림
  const fixed = FINAL_AUDIO;
  await run('ffmpeg', [
    '-y', '-i', wavPath,
    '-af', `apad=pad_dur=10,atrim=0:${TARGET_SEC}`,
    '-ac', '2', '-ar', '48000',
    fixed,
  ]);
  return fixed;
}

/* ---------- 비디오+오디오 믹싱 ---------- */
async function muxVideoAudio(videoPath, audioPath, outPath) {
  await run('ffmpeg', [
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-shortest',
    '-movflags', '+faststart',
    outPath,
  ]);
}

/* ---------- 메인 ---------- */
async function main() {
  await ensureOutDir();
  await ensureFfmpeg();

  if (!(await fileExists(ANCHOR_IMG_PATH))) {
    throw new Error(`앵커 이미지가 없습니다: ${ANCHOR_IMG_PATH}`);
  }
  const anchorB64 = await readFileBase64(ANCHOR_IMG_PATH);

  // 1) 비디오(6초)
  const video = await generateMonaVideo(anchorB64);

  // 2) 한국어 여성 음성 합성(정확 대사)
  const LINE = '영단어를 노트에 수백 번 써 봤지만, 아까운 잉크만 낭비했다구요?';
  const audio = await synthesizeKoreanFemale(LINE);

  // 3) Mux
  await muxVideoAudio(video, audio, FINAL_OUTPUT);

  const finalDur = await getDurationSec(FINAL_OUTPUT);
  console.log(`\n[완료] ${FINAL_OUTPUT} (${finalDur.toFixed(2)}s)\n`);
}

main().catch(err => {
  console.error('오류:', err);
  process.exit(1);
});
