"""Manual store-link pass for games RAWG could not match (2026-08-24).

Every link below was verified by hand this session:
- iOS via iTunes Search API (title similarity checked)
- Android via Play Store details page (HTTP 200 + title checked)
- Steam via appdetails API (appid -> name checked)
- Console links via RAWG store lookups on corrected slugs
- Nintendo URL guesses confirmed HTTP 200

Also handles, from the same audit:
- TITLE/YEAR fixes where the doc described a stale or wrong product
- the hitman-3 / hitman-world-of-assassination duplicate (batch K slip):
  WoA keeps the doc, gets the link set, hitman-3 is deleted + tombstoned
- deletion of dead/delisted games that have no store to link to:
  Alchemy Stars (EOS 2025-01), Black Clover M (EOS), Clash Mini
  (Supercell EOS 2024), Clash Quest (Supercell EOS 2022), Flappy Bird
  Family (Amazon-only, gone), Yo-kai Watch World (JP-only, EOS),
  Picross Luna (delisted both stores), Trivia Crack 2 (Etermax EOS),
  NARUTO X BORUTO mobile (product never existed; nearest real title
  Ninja Voltage also hit EOS)

Usage:
    python manual_link_pass.py          # dry run
    python manual_link_pass.py --apply
"""

import json
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

PROJECT = "playnxt-1a2c6"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/games"
SCRIPT_DIR = Path(__file__).parent

# doc_id -> links to merge (fill-only; existing keys are never overwritten)
LINKS = {
    "aznana": {
        "ios": "https://apps.apple.com/us/app/aznana/id1630903651",
        "android": "https://play.google.com/store/apps/details?id=com.caracolu.aznana",
    },
    "brain-test": {
        "ios": "https://apps.apple.com/us/app/brain-test-tricky-puzzles/id1486214495",
    },
    "brain-test-2": {
        "ios": "https://apps.apple.com/us/app/brain-test-2-tricky-stories/id1509517244",
        "android": "https://play.google.com/store/apps/details?id=com.unicostudio.braintest2new",
    },
    "cell-to-singularity": {
        "ios": "https://apps.apple.com/us/app/cell-to-singularity-evolution/id1327555461",
    },
    "civilization-6": {
        "android": "https://play.google.com/store/apps/details?id=com.aspyr.civvi",
    },
    "cooking-diary": {
        "ios": "https://apps.apple.com/us/app/cooking-diary-restaurant-game/id1214763610",
        "android": "https://play.google.com/store/apps/details?id=com.mytona.cookingdiary.android",
    },
    "doom-1993": {
        "steam": "https://store.steampowered.com/app/2280/DOOM__DOOM_II/",
    },
    "dragon-ball-z-fighters": {
        "ios": "https://apps.apple.com/us/app/dragon-ball-z-dokkan-battle/id951627425",
    },
    "dream-league-soccer": {
        "ios": "https://apps.apple.com/us/app/dream-league-soccer-2026/id1462911602",
    },
    "hitman-world-of-assassination": {
        "steam": "https://store.steampowered.com/app/1659040/",
        "playstation": "https://store.playstation.com/en-us/product/UP4572-CUSA18201_00-00000H3PRESTANDA",
        "xbox": "https://www.microsoft.com/en-us/p/hitman-3/9p2jc6r9s37c",
        "epic": "https://www.epicgames.com/store/en-US/product/hitman-3/",
        "nintendo": "https://www.nintendo.com/us/store/products/hitman-3-cloud-version-switch/",
    },
    "merge-mansion": {
        "ios": "https://apps.apple.com/us/app/merge-mansion-puzzles-story/id1484442152",
        "android": "https://play.google.com/store/apps/details?id=com.everywear.game5",
    },
    "mlb-the-show-24": {
        "nintendo": "https://www.nintendo.com/us/store/products/mlb-the-show-24-switch/",
    },
    "mlb-the-show-25": {
        "nintendo": "https://www.nintendo.com/us/store/products/mlb-the-show-25-switch/",
    },
    "monster-hunter-stories-3": {
        "steam": "https://store.steampowered.com/app/2852190/",
    },
    "my-boo": {
        "ios": "https://apps.apple.com/us/app/my-boo-virtual-pet-take-care/id706099830",
        "android": "https://play.google.com/store/apps/details?id=com.tapps.virtual.pet.free.myboo",
    },
    "n-plus-plus": {
        "steam": "https://store.steampowered.com/app/230270/N_NPLUSPLUS/",
    },
    "nba-2k-mobile": {
        "ios": "https://apps.apple.com/us/app/nba-2k-mobile-basketball-game/id1252850847",
        "android": "https://play.google.com/store/apps/details?id=com.catdaddy.nba2km",
    },
    "pokemon-tcg-live": {
        "ios": "https://apps.apple.com/us/app/pok%C3%A9mon-tcg-live/id1557962344",
    },
    "potion-craft": {
        "steam": "https://store.steampowered.com/app/1210320/Potion_Craft_Alchemist_Simulator/",
    },
    "project-sekai": {
        "ios": "https://apps.apple.com/us/app/hatsune-miku-colorful-stage/id1580044138",
    },
    "quiz-planet": {
        "ios": "https://apps.apple.com/us/app/quiz-planet/id1466208181",
    },
    "ratchet-clank-2016": {
        "playstation": "https://store.playstation.com/en-us/product/UP9000-CUSA01047_00-RATCHETPS4000000",
    },
    "redecor": {
        "ios": "https://apps.apple.com/us/app/redecor-home-design-game/id1413287364",
        "android": "https://play.google.com/store/apps/details?id=fi.reworks.redecor",
    },
    "resident-evil-3-2020": {
        "steam": "https://store.steampowered.com/app/952060/RESIDENT_EVIL_3/",
        "playstation": "https://store.playstation.com/en-us/product/UP0102-CUSA14168_00-BH3B000000000001",
        "xbox": "https://www.microsoft.com/en-us/p/resident-evil-3/9pljwxg6zkvq",
        "gog": "https://www.gog.com/en/game/resident_evil_3",
    },
    "runner2": {
        "steam": "https://store.steampowered.com/app/218060/",
    },
    "scrabble-go": {
        "android": "https://play.google.com/store/apps/details?id=com.pieyel.scrabble",
    },
    "shadow-fight-4": {
        "ios": "https://apps.apple.com/us/app/shadow-fight-4-arena/id1479050948",
        "android": "https://play.google.com/store/apps/details?id=com.nekki.shadowfightarena",
    },
    "битва": {  # Battlegrounds Mobile India
        "ios": "https://apps.apple.com/in/app/battlegrounds-mobile-india/id1526436837",
        "android": "https://play.google.com/store/apps/details?id=com.pubg.imobile",
    },
    # --- wave 2: docs where RAWG matched but returned an empty store set ---
    "borderlands-goty": {
        "steam": "https://store.steampowered.com/app/729040/Borderlands_Game_of_the_Year_Enhanced/",
    },
    "clash-of-kings": {
        "ios": "https://apps.apple.com/us/app/clash-of-kings-cok/id945274928",
        "android": "https://play.google.com/store/apps/details?id=com.hcg.cok.gp",
    },
    "death-gambit-afterlife": {
        "steam": "https://store.steampowered.com/app/356650/Deaths_Gambit_Afterlife/",
    },
    "dragon-quest-7-reimagined": {
        "steam": "https://store.steampowered.com/app/2499860/",
    },
    "evermerge": {
        "ios": "https://apps.apple.com/us/app/evermerge-merge-games-story/id1446344746",
        "android": "https://play.google.com/store/apps/details?id=com.bigfishgames.mergetalesgoog",
    },
    "fortnite": {
        "epic": "https://store.epicgames.com/en-US/p/fortnite",
    },
    "forza-horizon-6": {
        "steam": "https://store.steampowered.com/app/2483190/Forza_Horizon_6/",
    },
    "mario-golf-super-rush": {
        "nintendo": "https://www.nintendo.com/us/store/products/mario-golf-super-rush-switch/",
    },
    "mario-kart-world": {
        "nintendo": "https://www.nintendo.com/us/store/products/mario-kart-world-switch-2/",
    },
    "nainai-recipe": {
        "steam": "https://store.steampowered.com/app/1730460/Nainais_Recipe/",
    },
    "niche": {
        "steam": "https://store.steampowered.com/app/440650/Niche__a_genetics_survival_game/",
    },
    "nioh-3": {
        "steam": "https://store.steampowered.com/app/3681010/Nioh_3/",
    },
    "pokemon-legends-za": {
        "nintendo": "https://www.nintendo.com/us/store/products/pokemon-legends-z-a-switch/",
    },
    "shadow-of-the-colossus": {
        "playstation": "https://store.playstation.com/en-us/product/UP9000-CUSA08034_00-SOTC0000000000US",
    },
    "spider-man-miles-morales": {
        "steam": "https://store.steampowered.com/app/1817190/Marvels_SpiderMan_Miles_Morales/",
        "playstation": "https://store.playstation.com/en-us/concept/10000649",
        "epic": "https://store.epicgames.com/p/marvels-spider-man-miles-morales",
    },
    "sundered": {
        "steam": "https://store.steampowered.com/app/535480/Sundered_Eldritch_Edition/",
    },
    "tetris-99": {
        "nintendo": "https://www.nintendo.com/us/store/products/tetris-99-switch/",
    },
    "top-eleven": {
        "ios": "https://apps.apple.com/us/app/top-eleven-be-a-soccer-manager/id459035295",
        "android": "https://play.google.com/store/apps/details?id=eu.nordeus.topeleven.android",
    },
    "yoshi-mysterious-book": {
        "nintendo": "https://www.nintendo.com/us/store/products/yoshi-and-the-mysterious-book-switch-2/",
    },
}
# Verified but intentionally left unlinked: 2XKO (Riot client only),
# StarCraft II and World of Warcraft (Battle.net only — no matching store
# key), Dreams and Cruis'n Blast (store URLs not safely derivable),
# Saros (PS5 2026, no store page yet).

# doc_id -> field fixes (title/description corrections + missing years)
FIELD_FIXES = {
    # doc described a product that does not exist; the android link it
    # already carried is Dokkan Battle, so align the doc to reality
    "dragon-ball-z-fighters": {
        "title": "Dragon Ball Z Dokkan Battle",
        "title_lower": "dragon ball z dokkan battle",
        "year": 2015,
        "description_short": "Chain Ki spheres to unleash iconic attacks: the long-running DBZ puzzle-RPG juggernaut.",
    },
    # annual app renamed every season; keep the evergreen name
    "dream-league-soccer": {
        "title": "Dream League Soccer",
        "title_lower": "dream league soccer",
    },
    "monster-hunter-stories-3": {
        "title": "Monster Hunter Stories 3: Twisted Reflection",
        "title_lower": "monster hunter stories 3: twisted reflection",
        "year": 2026,
    },
    "aznana": {"year": 2023},
    "mlb-the-show-24": {"year": 2024},
    "doom-1993": {"year": 1993},
}

# dead / delisted / duplicate docs to remove (all tombstoned)
DELETE = [
    "alchemy-stars",           # service ended Jan 2025
    "black-clover-mobile",     # global service ended
    "clash-mini",              # Supercell EOS 2024
    "clash-quest",             # Supercell EOS 2022
    "flappy-bird-family",      # Amazon Fire only, unavailable
    "yo-kai-watch-mobile",     # JP-only, service ended
    "picross-luna",            # delisted from both stores
    "trivia-crack-2",          # Etermax discontinued it
    "naruto-x-boruto",         # product as described never existed
    "hitman-3",                # duplicate of hitman-world-of-assassination
]


def gcloud_token():
    gcloud = shutil.which("gcloud") or "gcloud"
    return subprocess.run([gcloud, "auth", "print-access-token"],
                          capture_output=True, text=True, check=True).stdout.strip()


def to_fs(v):
    if isinstance(v, bool): return {"booleanValue": v}
    if isinstance(v, int): return {"integerValue": str(v)}
    if isinstance(v, str): return {"stringValue": v}
    if isinstance(v, dict): return {"mapValue": {"fields": {k: to_fs(x) for k, x in v.items()}}}
    return {"nullValue": None}


def get_doc(doc_id, tok):
    q = urllib.parse.quote(doc_id, safe="")
    r = urllib.request.Request(f"{BASE}/{q}", headers={"Authorization": f"Bearer {tok}"})
    return json.load(urllib.request.urlopen(r))


def main():
    apply = "--apply" in sys.argv
    tok = gcloud_token()

    patched = 0
    for doc_id in sorted(set(LINKS) | set(FIELD_FIXES)):
        doc = get_doc(doc_id, tok)
        fields = doc.get("fields", {})
        existing = {}
        if "store_links" in fields:
            existing = {k: v.get("stringValue") for k, v in
                        fields["store_links"].get("mapValue", {}).get("fields", {}).items()}
        update = {}
        new_links = dict(existing)
        for k, v in LINKS.get(doc_id, {}).items():
            if k not in new_links:
                new_links[k] = v
        if new_links != existing:
            update["store_links"] = new_links
        for k, v in FIELD_FIXES.get(doc_id, {}).items():
            update[k] = v
        if not update:
            continue
        added = [k for k in new_links if k not in existing]
        print(f"PATCH {doc_id}: +links={added} fields={[k for k in update if k != 'store_links']}")
        if apply:
            fs = {k: to_fs(v) for k, v in update.items()}
            mask = "&".join(f"updateMask.fieldPaths={urllib.parse.quote(k)}" for k in fs)
            q = urllib.parse.quote(doc_id, safe="")
            r = urllib.request.Request(f"{BASE}/{q}?{mask}", method="PATCH",
                                       data=json.dumps({"fields": fs}).encode(),
                                       headers={"Authorization": f"Bearer {tok}",
                                                "Content-Type": "application/json"})
            urllib.request.urlopen(r)
            patched += 1

    for doc_id in DELETE:
        title = "?"
        try:
            doc = get_doc(doc_id, tok)
            title = doc["fields"].get("title", {}).get("stringValue", "?")
        except urllib.error.HTTPError:
            print(f"DELETE {doc_id}: already gone, skipping")
            continue
        print(f"DELETE {doc_id} ('{title}')")
        if apply:
            q = urllib.parse.quote(doc_id, safe="")
            r = urllib.request.Request(f"{BASE}/{q}", method="DELETE",
                                       headers={"Authorization": f"Bearer {tok}"})
            urllib.request.urlopen(r)

    if apply:
        tf = SCRIPT_DIR / "deleted_game_ids.json"
        ids = json.loads(tf.read_text(encoding="utf-8"))
        for d in DELETE:
            if d not in ids:
                ids.append(d)
        tf.write_text(json.dumps(ids, indent=1), encoding="utf-8")
        print(f"\npatched: {patched} | deleted: {len(DELETE)} | tombstones: {len(ids)}")
    else:
        print("\nDRY RUN — re-run with --apply to write.")


if __name__ == "__main__":
    main()
