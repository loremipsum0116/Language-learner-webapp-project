// 예시: CDN을 사용한 오디오 서빙 방법

// 현재 방식 (문제가 있는 방식)
app.get('/audio/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'public/audio', req.params.filename);
  res.sendFile(filePath); // ❌ 서버 리소스 사용
});

// 개선된 방식: CDN URL 제공
const CDN_BASE_URL = process.env.CDN_BASE_URL || 'https://your-cdn.com';

app.get('/api/audio/:filename', (req, res) => {
  const audioURL = `${CDN_BASE_URL}/audio/${req.params.filename}`;
  res.json({
    audioURL,
    filename: req.params.filename,
    // 클라이언트에서 직접 CDN에서 재생
  });
});

// 또는 데이터베이스에서 미리 CDN URL 저장
app.get('/api/vocabulary/:id', async (req, res) => {
  const word = await db.vocabulary.findUnique({
    where: { id: req.params.id }
  });

  res.json({
    ...word,
    audioURL: word.audioURL, // 이미 CDN URL로 저장됨
    exampleAudioURL: word.exampleAudioURL
  });
});

module.exports = { CDN_BASE_URL };