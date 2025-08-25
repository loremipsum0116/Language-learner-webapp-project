# analyze_vocabs.py
import json, re, unicodedata, collections, csv, argparse

def nfkc(s): return unicodedata.normalize("NFKC", s) if isinstance(s,str) else ""
def squash(s): 
    import re; return re.sub(r"\s+"," ", s).strip()
def norm_lemma(s): return squash(nfkc(s).lower())
def norm_pos(s): 
    m = {"n":"noun","n.":"noun","noun":"noun","v":"verb","v.":"verb","verb":"verb",
         "a":"adjective","adj":"adjective","adj.":"adjective","adjective":"adjective",
         "adv":"adverb","adv.":"adverb","adverb":"adverb"}
    x = squash(nfkc(s).lower())
    return m.get(x,x)
def strip_punct(s):
    import re; return squash(re.sub(r"[^\w\s가-힣·]", " ", s))
def norm_kox(s): return strip_punct(nfkc(s).lower())

ap = argparse.ArgumentParser()
ap.add_argument("-i","--input",required=True)
ap.add_argument("--dump-koexample-csv", default="koexample_dups.csv")
args = ap.parse_args()

data = json.load(open(args.input,"r",encoding="utf-8"))
L = len(data)

by_lemma = collections.Counter()
by_lempos = collections.Counter()
by_koex = collections.Counter()

normed = []
for it in data:
    ln = norm_lemma(it.get("lemma",""))
    pn = norm_pos(it.get("pos",""))
    kx = norm_kox(it.get("koExample",""))
    normed.append((ln,pn,kx,it))
    by_lemma[ln]+=1
    by_lempos[(ln,pn)]+=1
    if kx: by_koex[kx]+=1

print(f"[INFO] total items: {L}")
print(f"[INFO] unique lemma: {len(by_lemma)}  (dups over lemma: {L-len(by_lemma)})")
print(f"[INFO] unique lemma+pos: {len(by_lempos)}  (dups over lemma+pos: {L-len(by_lempos)})")
print(f"[INFO] koExample non-empty unique: {len(by_koex)}  (dups over koExample: {sum(c-1 for c in by_koex.values() if c>1)})")

print("\n[TOP] lemmas with most entries:")
for ln,c in by_lemma.most_common(15):
    if c>1: print(f"  {ln}: {c}")

# dump clusters where koExample identical appears >=2
rows=[]
for kx,c in by_koex.items():
    if c>=2:
        # collect a few examples
        items=[it for (ln,pn,kx2,it) in normed if kx2==kx][:8]
        for it in items:
            rows.append([kx, it.get("lemma",""), it.get("pos",""), (it.get("definition","") or "")[:120], it.get("koGloss","")])

if rows:
    with open(args.dump_koexample_csv, "w", newline="", encoding="utf-8") as f:
        w=csv.writer(f)
        w.writerow(["koExample_norm","lemma","pos","definition_head","koGloss"])
        w.writerows(rows)
    print(f"\n[INFO] Dumped koExample duplicate clusters → {args.dump_koexample_csv}")
else:
    print("\n[INFO] No repeated koExample found.")
