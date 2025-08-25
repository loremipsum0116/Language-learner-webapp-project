# -*- coding: utf-8 -*-
"""
Deduplicate CEFR vocab JSON:
- Input:  list[dict]  (each dict has fields like lemma, pos, levelCEFR, definition, koGloss, koExample, pronunciation, audioUrl ...)
- Output: list[dict]  (duplicates removed)
Strategy:
  1) Normalize fields.
  2) Hard duplicates: exact match on (lemma_norm, pos_norm, def_norm, kogloss_norm).
  3) Soft duplicates within (lemma_norm, pos_norm) groups using similarity on definition & koGloss.
  4) For a duplicate cluster, choose a representative by scoring:
       audioUrl > pronunciation > examples > longer informative definition > CEFR policy(min/max/keep)
"""

import json
import re
import argparse
import unicodedata
from collections import defaultdict

# Optional: rapidfuzz for high-quality similarity; fallback to difflib
try:
    from rapidfuzz import fuzz
    def sim_ratio(a: str, b: str) -> float:
        # token_set_ratio returns 0..100
        return fuzz.token_set_ratio(a, b) / 100.0
except Exception:
    import difflib
    def sim_ratio(a: str, b: str) -> float:
        return difflib.SequenceMatcher(None, a, b).ratio()


POS_CANON_MAP = {
    # common shorthands → canonical
    "n": "noun", "n.": "noun", "noun": "noun",
    "v": "verb", "v.": "verb", "verb": "verb",
    "a": "adjective", "adj": "adjective", "adj.": "adjective", "adjective": "adjective",
    "adv": "adverb", "adv.": "adverb", "adverb": "adverb",
    "prep": "preposition", "prep.": "preposition", "preposition": "preposition",
    "pron": "pronoun", "pron.": "pronoun", "pronoun": "pronoun",
    "det": "determiner", "det.": "determiner", "determiner": "determiner",
    "conj": "conjunction", "conj.": "conjunction", "conjunction": "conjunction",
    "int": "interjection", "interj": "interjection", "interj.": "interjection", "interjection": "interjection",
    "pv": "phrasal verb", "phrasal verb": "phrasal verb",
}

CEFR_ORDER = {"A1":1, "A2":2, "B1":3, "B2":4, "C1":5, "C2":6}

def nfkc(s: str) -> str:
    return unicodedata.normalize("NFKC", s) if isinstance(s, str) else ""

def squash_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()

def strip_punct(s: str) -> str:
    # keep Korean intact; remove most ASCII punctuation
    s = re.sub(r"[^\w\s가-힣·]", " ", s, flags=re.UNICODE)
    return squash_spaces(s)

def normalize_lemma(s: str) -> str:
    return squash_spaces(nfkc(s).lower())

def normalize_pos(s: str) -> str:
    raw = squash_spaces(nfkc(s).lower())
    return POS_CANON_MAP.get(raw, raw)

def normalize_definition(s: str) -> str:
    s = nfkc(s).lower()
    s = s.replace(" e.g. ", " ")
    s = strip_punct(s)
    return s

def normalize_kogloss(s: str) -> str:
    # remove leading "n. ", "v. " etc.
    t = nfkc(s).strip()
    t = re.sub(r"^(n|n\.|v|v\.|adj|adj\.|adv|adv\.|prep|prep\.|pron|pron\.|det|det\.|conj|conj\.|interj|interj\.)\s*", "", t, flags=re.IGNORECASE)
    t = t.replace("뜻:", "").replace("의미:", "")
    t = strip_punct(t.lower())
    return t

def normalize_koexample(s: str) -> str:
    return strip_punct(nfkc(s).lower())

def has_val(x) -> bool:
    return isinstance(x, str) and len(x.strip()) > 0

def cefr_pick(a: str, b: str, policy: str) -> str:
    if policy == "keep":
        return a if a == b or b == "" else a  # neutral; caller keeps original
    ra = CEFR_ORDER.get(a, 999)
    rb = CEFR_ORDER.get(b, 999)
    if policy == "min":
        return a if ra <= rb else b
    elif policy == "max":
        return a if ra >= rb else b
    return a

def score_item(it: dict) -> int:
    # higher is better
    sc = 0
    if has_val(it.get("audioUrl")): sc += 50
    if has_val(it.get("pronunciation")): sc += 20
    if has_val(it.get("example")): sc += 10
    if has_val(it.get("koExample")): sc += 10
    d = it.get("definition") or ""
    sc += min(len(d), 200) // 20  # +0..10 roughly, favors more informative definitions
    # small bonus if definition includes usage cues
    if any(k in d.lower() for k in ["that", "which", "when", "where", "used to"]): sc += 2
    return sc

def choose_representative(items: list, level_policy: str) -> dict:
    # tie-breaker includes CEFR policy at the end
    # copy to avoid mutating original
    ranked = sorted(items, key=lambda x: (score_item(x), -len((x.get("lemma") or ""))), reverse=True)
    best = dict(ranked[0])

    # CEFR resolve if different inside cluster
    for it in ranked[1:]:
        lv = best.get("levelCEFR") or ""
        best["levelCEFR"] = cefr_pick(lv, it.get("levelCEFR") or "", level_policy)

    return best

def cluster_soft_dups(group_items, def_thr: float, gloss_thr: float):
    """
    Greedy clustering: items belong to the same cluster if both def & koGloss
    similarity exceed thresholds against the cluster seed.
    """
    n = len(group_items)
    used = [False]*n
    clusters = []
    for i in range(n):
        if used[i]: continue
        seed = group_items[i]
        cluster = [seed]
        used[i] = True
        for j in range(i+1, n):
            if used[j]: continue
            cand = group_items[j]
            dsim = sim_ratio(seed["_def_norm"], cand["_def_norm"])
            gsim = sim_ratio(seed["_kogloss_norm"], cand["_kogloss_norm"])
            if dsim >= def_thr and gsim >= gloss_thr:
                cluster.append(cand)
                used[j] = True
        clusters.append(cluster)
    return clusters

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", "-i", required=True)
    ap.add_argument("--output", "-o", required=True)
    ap.add_argument("--def-threshold", type=float, default=0.92)
    ap.add_argument("--gloss-threshold", type=float, default=0.92)
    ap.add_argument("--level-policy", choices=["min","max","keep"], default="min")
    args = ap.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("Input JSON must be a list of objects")

    # 1) normalize & prepare
    prepared = []
    for idx, it in enumerate(data):
        lemma = it.get("lemma") or ""
        pos = it.get("pos") or ""
        definition = it.get("definition") or ""
        koGloss = it.get("koGloss") or ""
        koExample = it.get("koExample") or ""

        it2 = dict(it)  # shallow copy
        it2["_lemma_norm"] = normalize_lemma(lemma)
        it2["_pos_norm"] = normalize_pos(pos)
        it2["_def_norm"] = normalize_definition(definition)
        it2["_kogloss_norm"] = normalize_kogloss(koGloss)
        it2["_koexample_norm"] = normalize_koexample(koExample)
        prepared.append(it2)

    total_in = len(prepared)

    # 2) hard dedup by exact match of normalized (lemma,pos,definition,koGloss)
    seen = set()
    hard_unique = []
    hard_removed = 0
    for it in prepared:
        key = (it["_lemma_norm"], it["_pos_norm"], it["_def_norm"], it["_kogloss_norm"])
        if key in seen:
            hard_removed += 1
            continue
        seen.add(key)
        hard_unique.append(it)

    # 3) group by (lemma_norm, pos_norm)
    groups = defaultdict(list)
    for it in hard_unique:
        groups[(it["_lemma_norm"], it["_pos_norm"])].append(it)

    # 4) within each group, soft-dup clustering & choose representative
    out_items = []
    soft_merged = 0
    for (lem, pos), items in groups.items():
        if len(items) == 1:
            out_items.append(items[0])
            continue
        # cluster
        clusters = cluster_soft_dups(items, args.def_threshold, args.gloss_threshold)
        for cl in clusters:
            if len(cl) == 1:
                out_items.append(cl[0])
            else:
                rep = choose_representative(cl, args.level_policy)
                out_items.append(rep)
                soft_merged += (len(cl) - 1)

    # 5) drop helper fields & sort for determinism
    def drop_helpers(x: dict) -> dict:
        return {k: v for k, v in x.items() if not k.startswith("_")}

    final = [drop_helpers(x) for x in out_items]
    final = sorted(final, key=lambda x: (normalize_lemma(x.get("lemma","")), normalize_pos(x.get("pos","")), CEFR_ORDER.get(x.get("levelCEFR",""), 999), (x.get("definition") or "")[:64]))

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False, indent=2)

    print(f"[OK] Input: {total_in}")
    print(f"[OK] Hard-removed (exact dups): {hard_removed}")
    print(f"[OK] Soft-merged (within lemma+pos): {soft_merged}")
    print(f"[OK] Output: {len(final)} → {args.output}")

if __name__ == "__main__":
    main()
