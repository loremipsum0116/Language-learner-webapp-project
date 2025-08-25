import json, re, unicodedata
from collections import defaultdict

def nfkc(s): return unicodedata.normalize("NFKC", s) if isinstance(s,str) else ""
def squash(s): return re.sub(r"\s+"," ", s).strip()
def n_lemma(s): return squash(nfkc(s).lower())
def n_pos(s): return squash(nfkc(s).lower())

data = json.load(open("cefr_vocabs.json","r",encoding="utf-8"))
groups=defaultdict(list)
for i,it in enumerate(data):
    groups[(n_lemma(it.get("lemma","")), n_pos(it.get("pos","")))].append((i,it))

for (lem,pos), items in groups.items():
    if len(items)>1:
        print(f"[DUP] {lem} / {pos} × {len(items)}")
        for idx,it in items:
            print(" - idx:", idx, "| def:", (it.get("definition","") or "")[:120], "| koGloss:", it.get("koGloss",""))
