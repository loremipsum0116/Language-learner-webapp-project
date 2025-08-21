// server/generate-video-3part.mjs
import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const API_KEY = process.env.GOOGLE_API_KEY; // 또는 GEMINI_API_KEY
if (!API_KEY) throw new Error('GOOGLE_API_KEY 가 설정되지 않았습니다.');

const MODEL = 'veo-3.0-generate-preview';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'; // 리전 없음
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'out');
const FINAL_OUTPUT = path.join(OUT_DIR, 'danmusae_ad_concat.mp4');

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** 단순 프로세스 실행 헬퍼 */
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function ensureFfmpeg() {
  try {
    await run('ffmpeg', ['-version']);
  } catch {
    throw new Error('ffmpeg 이 설치되어 있지 않거나 PATH에 없습니다. 설치 후 재시도하세요.');
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
      // REST 스키마는 instances/parameters 사용
      instances: [{ prompt }],
      parameters: {
        aspectRatio: '16:9',
        // 필요 시 옵션 추가: personGeneration, safetySettings 등
      },
    }),
  });
  if (!res.ok) throw new Error(`[${res.status}] 작업 시작 실패: ${await res.text()}`);
  return res.json(); // { name: "models/.../operations/...." }
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

// 리다이렉트 수동 추적(헤더 유지)로 다운로드
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

/** 단일 프롬프트로 클립 생성 → 파일 저장 */
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

  // 코덱/FPS 통일(24fps, h264+aac, yuv420p)
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

/** 세 클립을 필터로 연결(concat filter_complex) */
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

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await ensureFfmpeg();

  // ===== 분할 프롬프트 3개 =====
const P1 = `
# 씬 1/3 — 도입(약 7–8초)
해질녘 도시 인도. 두 명의 흑인 남성이 나란히 걷는다. 네온 간판이 켜지고, 도시 앰비언스가 은은하다.
A: 뚱뚱한 체형에 머리를 민(스킨헤드 스타일) 흑인 남성. 한 손에 햄버거를 들고 한 입 베어 먹으며 말한다.
A(투덜이며, 한국어 대사): "이봐 친구, 요즘 말야. 수능을 공부하고 있는데, 도대체가 영단어를 암기하려 해도 머릿속에 들어오질 않는거야! 어제도 노트에다가 수백 번을 끄적였는데, 결국 아까운 볼펜 잉크만 낭비했지 뭐야."
# 연출: 와이드 투샷 → A 쪽 미디엄으로 천천히 팬. A는 햄버거를 한 손에 든 채 자연스럽게 씹고(입 모양 과장 금지), 다른 손으로 가볍게 제스처.
# 사운드: 대사는 한국어. 아주 약한 씹는 Foley(불쾌하지 않게 -20dB 이하), 도로 소음/사람들 웅성 약하게. BGM은 낮은 볼륨.
# 스타일: 사실적, 16:9, 자연광 톤, 과장된 고정관념 배제. 인물 묘사는 존중을 유지.
`;

const P2 = `
# 씬 2/3 — 제안(약 7–8초)
동일한 거리/의상/조명 연속성 유지. A는 여전히 햄버거를 손에 든 상태(한두 번만 가볍게 베어 먹음). B가 아이디어가 떠오른 듯 제스처.
B(설명, 한국어 대사): "음… 좋은 방법이 있었는데… 그래! 생각났어! 내가 현재 사용하고 있는 '단무새'라는 앱이 있다고. 과학적으로 입증된 망각 학습 곡선 로직을 써서, 너처럼 시험 준비할 땐 단기간에 엄청나게 많은 단어를 효과적으로 학습할 수 있어!"
# 연출: B 클로즈업. 손짓 강조, 배경 보케. A는 프레임 가장자리에서 햄버거를 들고 고개 끄덕이며 경청.
# 사운드: 한국어 대사, 거리 앰비언스 유지. A의 씹는 소리는 최소화(대사 방해 금지). BGM 일관성.
# 스타일: 씬1과 동일 톤(렌즈/색감/노출)로 연속성 확보.
`;

const P3 = `
# 씬 3/3 — 해소/마무리(약 7–8초)
A의 표정이 밝아진다. 햄버거를 잠시 내리고(또는 한 손에 편하게 들고) 둘이 나란히 걸으며 결론부 대사.
A(기쁜 표정, 한국어 대사): "그래? 어쩐지, 내 사촌동생도 이 앱으로 학습해서 하버드 대학교에 수석으로 입학했다더군."
B(미소, 한국어 대사): "단무새가 너의 등에 날개를 달아줄걸세, 친구!"
# 연출: A 클로즈업(햄버거는 과도한 클로즈업 금지) → 투샷으로 마무리, 햇살 플레어 살짝. 마지막 프레임은 자연스럽게 페이드아웃.
# 사운드: 한국어 대사 선명하게, 긍정적 느낌의 짧은 엔딩 큐. 앰비언스 일관성 유지.
# 스타일: 씬1·씬2와 동일 톤으로 완전한 연속성 유지.
`;


  // ===== 생성 파이프라인 =====
  const clip1 = await generateClip(P1, 'clip1');
  const clip2 = await generateClip(P2, 'clip2');
  const clip3 = await generateClip(P3, 'clip3');

  await concatClips([clip1, clip2, clip3], FINAL_OUTPUT);
  console.log(`\n완료: ${FINAL_OUTPUT}`);
}

main().catch(err => {
  console.error('파이프라인 오류:', err);
  process.exit(1);
});
