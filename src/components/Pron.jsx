export default function Pron({ ipa, ipaKo }) {
  if (!ipa && !ipaKo) return null;
  return (
    <div className="text-muted small mt-1" style={{ lineHeight: 1.2 }}>
      {ipa ? <span lang="en">[{ipa.replace(/^\[?|\]?$/g, '')}]</span> : null}
      {ipa && ipaKo ? <span className="mx-1">·</span> : null}
      {ipaKo ? <span>{ipaKo}</span> : null}
    </div>
  );
}
