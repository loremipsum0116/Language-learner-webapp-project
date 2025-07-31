// src/utils/dict.js
const isSentenceLike = (s) =>
    typeof s === 'string' && /\s|[.?!]/.test((s || '').trim());

export function asExamplesArray(examples) {
    if (Array.isArray(examples)) return examples;
    if (typeof examples === 'string') {
        try {
            const j = JSON.parse(examples);
            if (Array.isArray(j)) return j;
            if (j && Array.isArray(j.examples)) return j.examples;
        } catch { }
        return [];
    }
    if (examples && typeof examples === 'object') {
        if (Array.isArray(examples.examples)) return examples.examples;
    }
    return [];
}

/** lemma 기준의 한국어 뜻 선택(예문 번역이 아닌 '단어의 뜻' 우선) */
export function pickLemmaGloss(dictMeta, lemma, fallback = null) {
    if (!dictMeta) return fallback;
    const exs = asExamplesArray(dictMeta.examples);

    // 1) kind==='gloss' & 문장처럼 보이지 않는 항목(단어/구 수준)
    const gloss1 = exs.find(ex => ex?.kind === 'gloss' && !isSentenceLike(ex?.de));

    // 2) kind==='gloss' & de가 lemma와 정확히 일치
    const gloss2 = exs.find(
        ex => ex?.kind === 'gloss' &&
            ex?.de?.toLowerCase?.().trim() === lemma?.toLowerCase?.().trim()
    );

    // 3) 메타 필드 직접 제공
    const meta = dictMeta.glossKo || dictMeta.ko || null;

    // 4) 그 외 ko가 있으나 문장처럼 보이지 않는 항목
    const anyKoSingle = exs.find(ex => ex?.ko && !isSentenceLike(ex?.de));

    return gloss1?.ko ?? gloss2?.ko ?? meta ?? anyKoSingle?.ko ?? fallback;
}
