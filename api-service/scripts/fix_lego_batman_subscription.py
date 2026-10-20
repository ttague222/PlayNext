"""
One-off catalog fix, 2026-10-20: remove playstation_plus from lego-batman-legacy.

PlayStation Plus only offers a 1.5-hour full-game trial to Premium members;
the game is not included in any tier. The wrong tag fed the on_subscriptions
filter, SUBSCRIPTION_BOOST and share-card badges, and makes the scenario drift
check flag /play/holiday-couch-multiplayer.

Pre-write document: catalog_fix_2026_10_20_lego_batman_backup.json (same folder).
Refuses to write unless the record still holds exactly ["playstation_plus"].

    python scripts/fix_lego_batman_subscription.py
"""

import json
import shutil
import subprocess
import urllib.request

URL = (
    "https://firestore.googleapis.com/v1/projects/playnxt-1a2c6/databases/(default)"
    "/documents/games/lego-batman-legacy"
)


def main():
    gcloud = shutil.which("gcloud") or "gcloud"
    token = subprocess.run(
        [gcloud, "auth", "print-access-token"], capture_output=True, text=True, check=True
    ).stdout.strip()
    headers = {"Authorization": f"Bearer {token}"}

    doc = json.load(urllib.request.urlopen(urllib.request.Request(URL, headers=headers)))
    before = [
        v.get("stringValue")
        for v in doc["fields"].get("subscription_services", {}).get("arrayValue", {}).get("values", [])
    ]
    if before != ["playstation_plus"]:
        raise SystemExit(f"Record changed since the backup ({before}); not writing.")

    body = json.dumps({"fields": {"subscription_services": {"arrayValue": {}}}}).encode()
    req = urllib.request.Request(
        URL + "?updateMask.fieldPaths=subscription_services",
        method="PATCH",
        data=body,
        headers={**headers, "Content-Type": "application/json"},
    )
    after = json.load(urllib.request.urlopen(req))
    print("subscription_services:", before, "->", after["fields"].get("subscription_services"))


if __name__ == "__main__":
    main()
