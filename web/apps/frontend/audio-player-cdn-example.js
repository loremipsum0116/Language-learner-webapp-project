// 예시: CDN에서 오디오 재생하는 React 컴포넌트

import React from 'react';

// 현재 방식 (서버 부하)
const AudioPlayer_Old = ({ filename }) => {
  const audioURL = `/api/audio/${filename}`; // ❌ 서버 통과
  return <audio src={audioURL} controls />;
};

// 개선된 방식: CDN 직접 접근
const AudioPlayer_New = ({ audioURL }) => {
  return (
    <audio
      src={audioURL} // ✅ CDN에서 직접 로드
      controls
      preload="none" // 필요할 때만 로드
      onError={(e) => console.log('Audio load failed:', e)}
    />
  );
};

// 사용 예시
const VocabularyCard = ({ word }) => {
  return (
    <div>
      <h3>{word.text}</h3>
      <AudioPlayer_New audioURL={word.audioURL} />
      <AudioPlayer_New audioURL={word.exampleAudioURL} />
    </div>
  );
};

export default AudioPlayer_New;