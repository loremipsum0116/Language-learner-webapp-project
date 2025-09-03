export default function Pron({ ipa, ipaKo }) {
  if (!ipa && !ipaKo) return null;
  
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
