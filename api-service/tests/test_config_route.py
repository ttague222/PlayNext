"""
Tests for the /config route's version-aware ad_interval.

2026-09-29: ad_interval reverted from 4 to 3 for clients >= 1.5.1, which
carry the fix for the initial-fetch-counts-as-a-reroll bug. Older/unknown
clients still get 4 so they don't hit ads after just 2 visible rerolls.
"""

from fastapi.testclient import TestClient


def test_old_client_gets_legacy_ad_interval(client: TestClient):
    response = client.get("/api/config", headers={"X-App-Version": "1.5.0"})
    assert response.status_code == 200
    assert response.json()["ad_interval"] == 4


def test_fixed_client_gets_restored_ad_interval(client: TestClient):
    response = client.get("/api/config", headers={"X-App-Version": "1.5.1"})
    assert response.status_code == 200
    assert response.json()["ad_interval"] == 3


def test_newer_client_gets_restored_ad_interval_numeric_compare(client: TestClient):
    """1.10.0 must compare numerically greater than 1.5.1, not lexically less."""
    response = client.get("/api/config", headers={"X-App-Version": "1.10.0"})
    assert response.status_code == 200
    assert response.json()["ad_interval"] == 3


def test_missing_version_header_gets_legacy_ad_interval(client: TestClient):
    response = client.get("/api/config")
    assert response.status_code == 200
    assert response.json()["ad_interval"] == 4


def test_garbage_version_header_gets_legacy_ad_interval(client: TestClient):
    response = client.get("/api/config", headers={"X-App-Version": "not-a-version"})
    assert response.status_code == 200
    assert response.json()["ad_interval"] == 4


def test_shared_config_not_mutated_across_calls(client: TestClient):
    """A legacy-client request must not leave ad_interval overridden for
    later requests from a fixed client (the override must be a copy)."""
    first = client.get("/api/config", headers={"X-App-Version": "1.5.0"})
    assert first.json()["ad_interval"] == 4

    second = client.get("/api/config", headers={"X-App-Version": "1.5.1"})
    assert second.json()["ad_interval"] == 3

    # Re-request the legacy version to make sure the override wasn't
    # accidentally cleared either.
    third = client.get("/api/config", headers={"X-App-Version": "1.5.0"})
    assert third.json()["ad_interval"] == 4
