"""Sample the production engine for every seasonal collection (spec 4.2, 5.3).

Seasonal collections are framings over fixed quiz params, so picks must always
be real engine output. Before each content PR a human runs this script to
check that every collection's params:

  * never come back empty,
  * never trigger the engine's fallback hierarchy, and
  * still hold when the user filters to a single platform
    (pc, playstation, xbox, switch, mobile),

and to see which games the engine actually returns, so the collection title can
be checked against them.

Usage (from api-service/):
    python scripts/validate_seasonal.py
    python scripts/validate_seasonal.py --collection harvest-2026-long-weekend
    python scripts/validate_seasonal.py --runs 30 --platform-runs 10
    python scripts/validate_seasonal.py --api http://localhost:8000/api

Exit codes: 0 clean; 1 any empty/fallback run or failed request; 2 bad usage.

Production rate-limits to roughly 100 requests / 60 s per client, so requests
are paced and a 429 is retried with backoff before that call is given up on.
"""

import argparse
import json
import logging
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.services.seasonal_service import SeasonalContentError, load_seasonal  # noqa: E402

logger = logging.getLogger("validate-seasonal")

# PlayNxt's own project. Never the stray PlayBeacon deployment (...346141384720...).
DEFAULT_API = "https://playnxt-api-167253232570.us-central1.run.app/api"
DEFAULT_RUNS = 20
DEFAULT_PLATFORM_RUNS = 5
PLATFORMS = ["pc", "playstation", "xbox", "switch", "mobile"]
SESSION_ID = "validate-seasonal"
REQUEST_TIMEOUT_SECONDS = 30
PACING_SECONDS = 0.7
BACKOFF_SECONDS = [5, 10, 20]
TOP_N = 10


def summarize(runs: List[dict]) -> dict:
    """Tally games across runs and count empty and fallback runs."""
    counts: Dict[str, int] = {}
    empty_runs = 0
    fallback_runs = 0
    for run in runs:
        picks = run.get("recommendations") or []
        if not picks:
            empty_runs += 1
        if run.get("fallback_applied"):
            fallback_runs += 1
        for pick in picks:
            counts[pick["game_id"]] = counts.get(pick["game_id"], 0) + 1
    tally = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return {"tally": tally, "empty_runs": empty_runs, "fallback_runs": fallback_runs}


def exit_code(reports: List[dict]) -> int:
    """1 if any report has empty runs, fallback runs or failed requests, else 0."""
    for report in reports:
        summary = report["summary"]
        if summary["empty_runs"] or summary["fallback_runs"] or report["errors"]:
            return 1
    return 0


def post_json(
    url: str,
    payload: dict,
    opener: Callable = urllib.request.urlopen,
    sleep: Callable[[float], None] = time.sleep,
) -> Optional[dict]:
    """POST JSON and return the decoded body, or None if the call ultimately fails.

    Only HTTP 429 is retried (with backoff); any other failure gives up at once.
    """
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    for attempt in range(len(BACKOFF_SECONDS) + 1):
        try:
            with opener(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < len(BACKOFF_SECONDS):
                logger.warning("  429 rate limited, backing off %ss", BACKOFF_SECONDS[attempt])
                sleep(BACKOFF_SECONDS[attempt])
                continue
            logger.error("  request failed: HTTP %s", exc.code)
            return None
        except (urllib.error.URLError, OSError, ValueError) as exc:
            logger.error("  request failed: %s", exc)
            return None
    return None


def sample(api: str, params: dict, platforms: Optional[List[str]], runs: int) -> Tuple[List[dict], int]:
    """POST /recommend `runs` times; return (responses, failed request count)."""
    payload = dict(params)
    payload["session_id"] = SESSION_ID
    payload["excluded_game_ids"] = []
    if platforms:
        payload["platforms"] = platforms
    responses: List[dict] = []
    errors = 0
    for _ in range(runs):
        response = post_json(f"{api.rstrip('/')}/recommend", payload)
        if response is None:
            errors += 1
        else:
            responses.append(response)
        time.sleep(PACING_SECONDS)
    return responses, errors


def _titles(runs: List[dict]) -> Dict[str, str]:
    return {
        pick["game_id"]: pick.get("title", "")
        for run in runs
        for pick in (run.get("recommendations") or [])
    }


def _report(label: str, responses: List[dict], errors: int) -> dict:
    return {"label": label, "summary": summarize(responses), "errors": errors}


def _log_verdict_line(report: dict) -> None:
    summary = report["summary"]
    ok = not (summary["empty_runs"] or summary["fallback_runs"] or report["errors"])
    logger.info(
        "  %-14s %s  empty=%d fallback=%d errors=%d",
        report["label"],
        "ok  " if ok else "FAIL",
        summary["empty_runs"],
        summary["fallback_runs"],
        report["errors"],
    )


def validate_collection(api: str, collection, runs: int, platform_runs: int) -> List[dict]:
    """Sample one collection unfiltered, then once per single platform."""
    params = collection.params.model_dump(mode="json")
    logger.info("")
    logger.info("== %s: %s", collection.id, collection.title)
    logger.info("   params: %s", json.dumps(params, sort_keys=True))

    responses, errors = sample(api, params, None, runs)
    reports = [_report("unfiltered", responses, errors)]

    titles = _titles(responses)
    tally = reports[0]["summary"]["tally"]
    logger.info("   top %d games over %d runs:", TOP_N, len(responses))
    logger.info("   %5s  %-40s %s", "count", "game_id", "title")
    for game_id, count in tally[:TOP_N]:
        logger.info("   %5d  %-40s %s", count, game_id, titles.get(game_id, ""))
    if len(tally) > TOP_N:
        logger.info("   ... %d more distinct games", len(tally) - TOP_N)
    logger.info("   distinct games: %d", len(tally))

    logger.info("   platform report (%d runs each):", platform_runs)
    _log_verdict_line(reports[0])
    for platform in PLATFORMS:
        responses, errors = sample(api, params, [platform], platform_runs)
        report = _report(platform, responses, errors)
        reports.append(report)
        _log_verdict_line(report)
    return reports


def main(argv: Optional[List[str]] = None) -> int:
    logging.basicConfig(level=logging.INFO, stream=sys.stdout, format="%(message)s")

    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--api", default=DEFAULT_API, help="API base URL (default: PlayNxt production)")
    parser.add_argument("--runs", type=int, default=DEFAULT_RUNS, help="unfiltered runs per collection")
    parser.add_argument(
        "--platform-runs", type=int, default=DEFAULT_PLATFORM_RUNS, help="runs per single-platform filter"
    )
    parser.add_argument("--collection", metavar="ID", help="only sample this collection id")
    args = parser.parse_args(argv)

    try:
        content = load_seasonal()
    except SeasonalContentError as exc:
        logger.error("%s", exc)
        return 2

    collections = [c for season in content.seasons for c in season.collections]
    if args.collection:
        collections = [c for c in collections if c.id == args.collection]
        if not collections:
            logger.error("Unknown collection id: %s", args.collection)
            return 2

    logger.info("Sampling %d collection(s) against %s", len(collections), args.api)
    reports: List[dict] = []
    for collection in collections:
        collection_reports = validate_collection(args.api, collection, args.runs, args.platform_runs)
        for report in collection_reports:
            report["label"] = f"{collection.id}/{report['label']}"
        reports.extend(collection_reports)

    failing = [r["label"] for r in reports if exit_code([r])]
    logger.info("")
    if failing:
        logger.info("VERDICT: FAIL (%d of %d samples)", len(failing), len(reports))
        for label in failing:
            logger.info("  - %s", label)
    else:
        logger.info("VERDICT: PASS (%d samples, no empty runs, no fallback, no errors)", len(reports))
    return exit_code(reports)


if __name__ == "__main__":
    sys.exit(main())
