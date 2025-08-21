// server/generate-video-3part.mjs
// Node 18+ 권장 (global fetch 존재)
// ffmpeg/ffprobe 필수 설치: https://ffmpeg.org

import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!API_KEY) throw new Error('GEMINI_API_KEY 또는 GOOGLE_API_KEY 환경변수가 필요합니다.');

const ai = new GoogleGenAI({ apiKey: API_KEY });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'out');
const FINAL_OUTPUT = path.join(OUT_DIR, 'danmusae_ad_concat.mp4');

// ===== 실행/제한 옵션 =====
const USE_FRAME_CHAINING = true;          // 장면 연속성 강화(직전 클립 말미 프레임을 다음 앵커로)
const BETWEEN_CALLS_MS = 15000;           // 클립 생성 간 휴지기(레이트리밋 완화)
const MAX_RETRIES = 6;                    // 429/503 재시도 횟수
const BASE_BACKOFF_MS = 4000;             // 백오프 시작 지연
const BACKOFF_FACTOR = 1.7;               // 지수 계수
const MAX_BACKOFF_MS = 60_000;            // 백오프 상한
const POLL_START_MS = 12_000;             // 폴링 간격 시작
const POLL_MAX_MS = 45_000;               // 폴링 간격 상한
const MIN_VIDEO_BYTES = 200_000;          // 무결성 최소 바이트

// ===== 모델 =====
const MODEL_VEO = 'veo-3.0-generate-preview';   // Veo 3 (Gemini API)
const MODEL_IMAGEN = 'imagen-3.0-generate-002'; // Imagen 3 (Gemini API)

// ===== 생성 제약(수염·텍스트 금지 등) =====
const NEGATIVE_PROMPT = [
  'full beard', 'thick beard', 'long beard',
  'moustache', 'mustache', 'goatee', 'sideburns',
  'heavy stubble',
  'identity change', 'different person',
  'mismatched outfit', 'text overlay', 'subtitle', 'watermark', 'logo'
].join(', ');

// ===== 공통 일관성 규칙(+ 영상 구도만 업데이트) =====
const CONSISTENCY = `
# 캐릭터/시간대 고정(모든 클립 공통)
- 주연: 흑인 남성 두 명만 등장. 인종/피부톤/얼굴형/체형/헤어스타일 불변.
- A: 흑인 남성, **체격 매우 풍만(플러스 사이즈)**, 민머리(스킨헤드), **완전 민면(수염 없음)**.
  의상: 검은 후디 + 회색 조거팬츠. 소품: 왼손에 치즈버거(노란 포장지).
- B: 흑인 남성, 보통 체형, 짧은 곱슬머리, **연한 five o’clock shadow(아주 옅은 수염자국)**.
  (수염은 옅고 균일, 콧수염/턱수염/구렛나루는 두드러지지 않음)
  의상: 청재킷 + 흰 티셔츠 + 진청 바지.
- 외형/의상/소품/피부톤을 전 클립에서 동일하게 유지.
- 엑스트라는 식별 불가한 실루엣/보케 수준.
- **시간대 앵커: 모든 장면은 ‘오후 5시’(현지 시간, 골든아워 직전).** 색온도/광량/그림자 길이 일관 유지.
- 화면비 16:9, 사실적 톤, 자연광 느낌.

# (영상 구도) 카메라 파라미터/무빙 — *신규 반영*
- 카메라 기준: **아이레벨 ±10cm**, **정면 15° 전진**, **35mm 등가**, **셔터 1/50s**.
- WB/ISO는 모든 클립에서 동일 기준 유지(룩 매칭).
- 무빙은 **미세한 핸드헬드** 수준으로 자연스럽게; 과도한 떨림 금지.
- 온스크린 텍스트/자막/간판 불가(화면 내 텍스트 금지).

# 오디오/대사(기존 유지)
- **모든 대사는 자연스러운 한국어.**(TTS/더빙 전제) 화면 내 텍스트·자막 삽입 금지.
`.trim();

// ===== 씬 프롬프트(대사는 한국어 유지, "영상 구도"만 강화) =====
const P1 = `
${CONSISTENCY}
# 씬 1/3 — 도입(약 7–8초)
오후 5시 무렵 도시 인도. 두 흑인 남성이 나란히 걷는다.
A(한국어, 약간 투덜이며):
"요즘 수능 준비하는데, 영단어가 도무지 머리에 안 들어와. 어젯밤에도 수백 번 써봤지만 결국 잉크만 낭비했어."

# 연출(영상 구도):
- **와이드 투샷 시작 → A로 천천히 슬로 팬/슬로 푸시 인하여 미디엄샷**.
- 카메라: 아이레벨 ±10cm, 35mm eq, 1/50s, 정면 15° 전진. 미세 핸드헬드.
- 인물의 걸음에 맞춰 아주 약한 패럴랙스. 배경 네온/보케는 과도하지 않게.
- 화면 내 텍스트/자막 금지.
`.trim();

const P2 = `
${CONSISTENCY}
# 씬 2/3 — 제안(약 7–8초)
[룩/시간 앵커] 씬1의 **마지막 프레임과 동일한 구도·노출·색온도**에서 시작. 인물/의상/피부톤 동일.
B(한국어, 간결하게):
"'단무새'라는 앱을 써봐. 과학적으로 설계된 망각 학습 곡선 스케줄로 단어를 효율적으로 익힐 수 있어."

# 연출(영상 구도):
- **B 클로즈업**(A는 프레임 에지에서 살짝 고개 끄덕임).
- 배경은 **소프트 보케**. 아이레벨, 35mm eq, 1/50s 유지. 미세 핸드헬드.
- 씬1과 **WB/ISO 동일**로 컬러/노출 매칭.
- 화면 내 텍스트/자막 금지.
`.trim();

const P3 = `
${CONSISTENCY}
# 씬 3/3 — 해소(약 7–8초)
[룩/시간 앵커] 씬1의 마지막 프레임 기준과 동일한 구도·노출·색온도. 인물/의상 변경 없음.
A(한국어, 휴대폰을 보며):
"맙소사, 한 달에 3,300원? 내 지갑이 살찌겠는걸!"
B(한국어):
"단무새와 함께라면, 네 머리는 영어사전이 될 거야!"

# 연출(영상 구도):
- **A 클로즈업 → 투샷으로 마무리**, 아주 은은한 **선 플레어** 허용.
- 자연스러운 **페이드아웃**. 아이레벨, 35mm eq, 1/50s. WB/ISO 매칭.
- 화면 내 텍스트/자막 금지.
`.trim();

// ===== 유틸 =====
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  await run('ffmpeg', ['-version']).catch(() => { throw new Error('ffmpeg 미설치'); });
  await run('ffprobe', ['-version']).catch(() => { throw new Error('ffprobe 미설치'); });
}

// ===== 재시도(429/503) 공통 유틸 =====
async function withRetries(fn, {
  retries = MAX_RETRIES,
  baseDelay = BASE_BACKOFF_MS,
  factor = BACKOFF_FACTOR,
  maxDelay = MAX_BACKOFF_MS,
} = {}) {
  let attempt = 0, delay = baseDelay;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      const status = e?.status || e?.code || e?.response?.status;
      if (!(status === 429 || status === 503)) throw e;
      if (attempt >= retries) throw e;

      // Retry-After 헤더가 있으면 우선 적용
      let retryAfterMs = 0;
      try {
        const ra = e?.response?.headers?.get?.('retry-after');
        if (ra) retryAfterMs = Math.max(0, Number(ra) * 1000);
      } catch {}

      const sleepMs = retryAfterMs || Math.min(maxDelay, delay) + Math.floor(Math.random() * 1000);
      console.warn(`[RETRY] ${status} → ${sleepMs}ms 대기 후 재시도(${attempt + 1}/${retries})`);
      await sleep(sleepMs);
      delay = Math.min(maxDelay, Math.floor(delay * factor));
      attempt++;
    }
  }
}

// ===== 폴링(점증 간격) =====
async function pollOperation(getOpOnce) {
  let pollDelay = POLL_START_MS;
  while (true) {
    const op = await withRetries(() => getOpOnce());
    if (op?.done) return op;
    await sleep(pollDelay);
    pollDelay = Math.min(POLL_MAX_MS, Math.floor(pollDelay * 1.35));
  }
}

// ===== 안전 다운로드 + 검증(name/uri 모두 지원) =====
async function downloadVideoOrThrow(aiClient, fileRef, outPath, { minBytes = MIN_VIDEO_BYTES } = {}) {
  const isStr = typeof fileRef === 'string';
  const name = !isStr && fileRef?.name ? String(fileRef.name)
             : (isStr && fileRef.startsWith('files/') ? fileRef : null);
  const uri  = (!isStr && fileRef?.uri) ? String(fileRef.uri)
             : (isStr && /^https?:\/\//i.test(fileRef) ? fileRef : null);

  await fs.mkdir(path.dirname(outPath), { recursive: true });

  const tmpDir = path.join(process.env.TEMP || path.dirname(outPath), 'veo_tmp');
  await fs.mkdir(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, `clip_${Date.now()}_${Math.random().toString(36).slice(2)}.part`);

  if (name) {
    console.log(`[DL] via SDK name → ${tmpPath}`);
    await withRetries(() => aiClient.files.download({ file: name, downloadPath: tmpPath }));
  } else if (uri) {
    console.log(`[DL] via URI → ${tmpPath}`);
    let current = uri, hopped = 0;
    while (true) {
      const res = await withRetries(() => fetch(current, {
        redirect: 'manual',
        headers: { 'x-goog-api-key': API_KEY }
      }));
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) throw new Error('redirect location 없음');
        current = loc;
        if (++hopped > 5) throw new Error('redirect hop 초과');
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} 다운로드 실패: ${text}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(tmpPath, buf);
      break;
    }
  } else {
    throw new Error('invalid fileRef: name도 uri도 없음: ' + JSON.stringify(fileRef));
  }

  // flush 대기
  for (let i = 0; i < 10; i++) {
    try { await fs.access(tmpPath); break; } catch { await sleep(300); }
  }

  // 무결성 검사
  const st = await fs.stat(tmpPath).catch(() => { throw new Error(`다운로드 파일이 생성되지 않음: ${tmpPath}`); });
  if (!st.size || st.size < minBytes) throw new Error(`다운로드 용량 비정상(${st.size}B). JSON/에러문서 가능성.`);

  await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=filename,format_name,format_long_name,duration',
    '-of', 'json', tmpPath,
  ]);

  await fs.copyFile(tmpPath, outPath);
  await fs.unlink(tmpPath).catch(() => {});
  console.log(`[DL] done  -> ${outPath}`);
}

// ===== 체크포인트 유틸 =====
async function existsNonEmpty(p) {
  try {
    const st = await fs.stat(p);
    return st.size > 0;
  } catch { return false; }
}

// ===== 1) 앵커 이미지(캐시 재사용) =====
async function generateAnchorImage() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const anchorPath = path.join(OUT_DIR, 'anchor.png');

  // 캐시: 존재 시 재사용
  try {
    const b = await fs.readFile(anchorPath);
    if (b.length > 0) {
      console.log('[ANCHOR] 기존 anchor.png 재사용');
      return { imageBytes: b.toString('base64'), mimeType: 'image/png' };
    }
  } catch {}

  const promptEn = `
Photorealistic still frame at 5 PM golden hour, 16:9.
Two adult Black men standing side-by-side on a city sidewalk, eye-level camera.
A: bald (shaved head), **very heavy / plus-size build** with a clearly larger belly and thicker arms,
   wearing a black hoodie and gray jogger pants, holding a cheeseburger in yellow paper in left hand,
   clean-shaven (completely no facial hair).
B: short curly hair, average build, wearing a denim jacket over a white T-shirt and dark blue jeans,
   with a **subtle five o'clock shadow** (very light, uniform stubble). Not a beard or a moustache; sideburns not prominent.
Natural color grade; no text/logos/subtitles.
`.trim();

  const res = await withRetries(() =>
    ai.models.generateImages({ model: MODEL_IMAGEN, prompt: promptEn })
  );

  const imageBytes = res.generatedImages?.[0]?.image?.imageBytes;
  if (!imageBytes) throw new Error('앵커 이미지 생성 실패');

  await fs.writeFile(anchorPath, Buffer.from(imageBytes, 'base64'));
  console.log(`[ANCHOR] 생성: ${anchorPath}`);
  return { imageBytes, mimeType: 'image/png' };
}

// ===== 2) 비디오 생성(Veo 3, 이미지→비디오) =====
async function generateClipWithImage(prompt, fileBase, refImage) {
  const outPath = path.join(OUT_DIR, `${fileBase}.mp4`);
  if (await existsNonEmpty(outPath)) {
    console.log(`[SKIP] 이미 존재: ${outPath}`);
    return outPath;
  }

  // 생성 요청 자체 재시도
  let op = await withRetries(() =>
    ai.models.generateVideos({
      model: MODEL_VEO,
      prompt,
      image: refImage, // { imageBytes, mimeType }
      config: {
        aspectRatio: '16:9',
        negativePrompt: NEGATIVE_PROMPT,
        personGeneration: 'allow_adult',
      },
    })
  );

  // 폴링(점증 간격 + 재시도)
  op = await pollOperation(() => withRetries(() => ai.operations.getVideosOperation({ operation: op })));

  const fileRef = op?.response?.generatedVideos?.[0]?.video;
  if (!fileRef) {
    console.error(JSON.stringify(op?.response, null, 2));
    throw new Error('Veo 응답에 generatedVideos[0].video 없음');
  }

  await downloadVideoOrThrow(ai, fileRef, outPath);
  return outPath;
}

// ===== 3) 프레임 체이닝 =====
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
async function extractTailFrameAsAnchor(filePath, fileBase) {
  const dur = await getDurationSec(filePath);
  const ts = Math.max(0, dur - 0.2);
  const outPng = path.join(OUT_DIR, `${fileBase}_tail.png`);
  await run('ffmpeg', ['-y', '-ss', String(ts), '-i', filePath, '-frames:v', '1', outPng]);
  const b64 = (await fs.readFile(outPng)).toString('base64');
  return { imageBytes: b64, mimeType: 'image/png' };
}

// ===== 4) 클립 병합 =====
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

// ===== 메인 =====
async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await ensureFfmpeg();

  // 1) 초기 앵커 이미지(캐시 재사용)
  let refImage = await generateAnchorImage(); // out/anchor.png

  // 2) clip1
  const clip1 = await generateClipWithImage(P1, 'clip1', refImage);
  await sleep(BETWEEN_CALLS_MS);

  // 3) clip2
  if (USE_FRAME_CHAINING) {
    refImage = await extractTailFrameAsAnchor(clip1, 'clip1');
  }
  const clip2 = await generateClipWithImage(P2, 'clip2', refImage);
  await sleep(BETWEEN_CALLS_MS);

  // 4) clip3
  if (USE_FRAME_CHAINING) {
    refImage = await extractTailFrameAsAnchor(clip2, 'clip2');
  }
  const clip3 = await generateClipWithImage(P3, 'clip3', refImage);

  // 5) 결합
  await concatClips([clip1, clip2, clip3], FINAL_OUTPUT);
  console.log(`\n[OK] 완료: ${FINAL_OUTPUT}`);
}

main().catch(err => {
  console.error('파이프라인 오류:', err);
  process.exit(1);
});
