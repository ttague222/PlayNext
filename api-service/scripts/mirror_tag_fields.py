"""Mirror the split tag fields across the production catalog.

Two schema generations left split fields: older JSON-seeded docs carry
`genres`/`moods` while the engine's filter and taste-profile paths read
`genre_tags`/`mood_tags` (and some hardcoded-seeded docs have only the
_tags forms). Fill-only in both directions: whichever side is missing or
empty gets a copy of the other. Never overwrites a non-empty field.

Usage:
    python mirror_tag_fields.py            # dry run
    python mirror_tag_fields.py --apply
"""

import json
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request

PROJECT = "playnxt-1a2c6"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/games"
PAIRS = [("genres", "genre_tags"), ("moods", "mood_tags")]


def gcloud_token():
    gcloud = shutil.which("gcloud") or "gcloud"
    return subprocess.run([gcloud, "auth", "print-access-token"],
                          capture_output=True, text=True, check=True).stdout.strip()


def parse_val(v):
    if "stringValue" in v: return v["stringValue"]
    if "arrayValue" in v: return [parse_val(x) for x in v["arrayValue"].get("values", [])]
    return None


def main():
    apply = "--apply" in sys.argv
    tok = gcloud_token()
    fields_q = "&".join(f"mask.fieldPaths={f}" for pair in PAIRS for f in pair)
    games, page = [], None
    while True:
        url = f"{BASE}?pageSize=300&{fields_q}" + (f"&pageToken={page}" if page else "")
        r = urllib.request.Request(url, headers={"Authorization": f"Bearer {tok}"})
        d = json.load(urllib.request.urlopen(r))
        for doc in d.get("documents", []):
            g = {k: parse_val(v) for k, v in doc.get("fields", {}).items()}
            g["_doc_id"] = doc["name"].rsplit("/", 1)[-1]
            games.append(g)
        page = d.get("nextPageToken")
        if not page:
            break
    print(f"fetched {len(games)} games")

    patched = 0
    counts = {f"{a}->{b}": 0 for a, b in PAIRS} | {f"{b}->{a}": 0 for a, b in PAIRS}
    for g in games:
        update = {}
        for a, b in PAIRS:
            va, vb = g.get(a) or [], g.get(b) or []
            if va and not vb:
                update[b] = va
                counts[f"{a}->{b}"] += 1
            elif vb and not va:
                update[a] = vb
                counts[f"{b}->{a}"] += 1
        if not update:
            continue
        patched += 1
        if apply:
            fields = {k: {"arrayValue": {"values": [{"stringValue": s} for s in v]}} for k, v in update.items()}
            mask = "&".join(f"updateMask.fieldPaths={k}" for k in fields)
            doc_id = urllib.parse.quote(g["_doc_id"], safe="")
            r = urllib.request.Request(f"{BASE}/{doc_id}?{mask}", method="PATCH",
                                       data=json.dumps({"fields": fields}).encode(),
                                       headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
            urllib.request.urlopen(r)
    print("mirror counts:", {k: v for k, v in counts.items() if v})
    print(f"docs {'patched' if apply else 'needing patch'}: {patched}")
    if not apply:
        print("DRY RUN — re-run with --apply to write.")


if __name__ == "__main__":
    main()
