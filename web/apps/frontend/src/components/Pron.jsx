export default function Pron({ ipa, ipaKo, hiragana, romaji }) {
  // 영어 발음과 일본어 발음 모두 지원
  if (!ipa && !ipaKo && !hiragana && !romaji) return null;

  // 일본어 발음 정보가 있는 경우
  if (hiragana || romaji) {
    return (
      <div className="text-muted small mt-1" style={{ lineHeight: 1.2 }}>
        {hiragana && <span lang="ja">[{hiragana}]</span>}
        {hiragana && romaji && <span className="mx-1">·</span>}
        {romaji && <span>{romaji}</span>}
      </div>
    );
  }

  // 영어 발음 정보 (기존 로직)
  // ipa와 ipaKo가 같은 값이면 하나만 표시
  if (ipa === ipaKo) {
    return (
      <div className="text-muted small mt-1" style={{ lineHeight: 1.2 }}>
        <span lang="en">[{ipa.replace(/^\[?|\]?$/g, '')}]</span>
      </div>
    );
  }

  return (
    <div className="text-muted small mt-1" style={{ lineHeight: 1.2 }}>
      {ipa ? <span lang="en">[{ipa.replace(/^\[?|\]?$/g, '')}]</span> : null}
      {ipa && ipaKo ? <span className="mx-1">·</span> : null}
      {ipaKo ? <span>{ipaKo}</span> : null}
    </div>
  );
}
