"""Merge researched entries into entries.json after checking them.

Usage: python3 -I merge_entries.py <entries.json> <new.json>:<pages dir> [<new.json>:<pages dir> ...]

Each new entry is kept only if it has every required key, a plausible position, an http(s) source, a known
domain and mode, and its quote is found (after whitespace and quote-mark normalisation) in a saved page under
the given pages dir. Rejected entries are printed with the reason. Existing titles are not duplicated.
"""
import json, sys, os, re, html, unicodedata

KEYS = ["title", "place", "country", "lat", "lon", "domain", "mode", "mode_reason", "who", "does", "pays", "cost",
        "result", "contested", "when_it_stops", "quote", "quote_speaker", "source_title", "source_publisher",
        "source_url", "source_date", "notes"]
DOMAINS = {"farming", "care", "commons", "kitchen", "wetland", "trees", "land", "species", "vector", "vaccine",
           "eradication", "abortion", "contraception", "birth", "repair"}


def norm(s):
    s = unicodedata.normalize("NFKC", html.unescape(s))
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), ("–", "-"), ("—", "-"), (" ", " ")):
        s = s.replace(a, b)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).lower().strip()


def corpus(d):
    out = []
    for root, _, fs in os.walk(d):
        for f in fs:
            try:
                out.append((f, norm(open(os.path.join(root, f), encoding="utf-8", errors="ignore").read())))
            except OSError:
                pass
    return out


base_path = sys.argv[1]
base = json.load(open(base_path, encoding="utf-8"))
seen = {norm(e["title"]) for e in base}
for arg in sys.argv[2:]:
    path, pages = arg.split(":", 1)
    texts = corpus(pages)
    new = json.load(open(path, encoding="utf-8"))
    kept = 0
    for e in new:
        why = []
        missing = [k for k in KEYS if k not in e]
        if missing:
            why.append("missing " + ",".join(missing))
        else:
            if e["domain"] not in DOMAINS:
                why.append("domain " + str(e["domain"]))
            if e["mode"] not in ("repeats", "turns"):
                why.append("mode " + str(e["mode"]))
            try:
                if not (-90 <= float(e["lat"]) <= 90 and -180 <= float(e["lon"]) <= 180):
                    why.append("position")
            except (TypeError, ValueError):
                why.append("position")
            if not re.match(r"^https?://", str(e["source_url"])):
                why.append("source_url")
            q = norm(str(e["quote"])).strip('."\' ')
            hits = [f for f, t in texts if q and q in t]
            if not hits:
                why.append("quote not found in saved pages")
            if norm(e["title"]) in seen:
                why.append("duplicate title")
        if why:
            print("REJECT", os.path.basename(path), "|", e.get("title"), "|", "; ".join(why))
            continue
        seen.add(norm(e["title"]))
        base.append({k: e[k] for k in KEYS})
        kept += 1
    print(os.path.basename(path), "kept", kept, "of", len(new))
json.dump(base, open(base_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("total", len(base))
