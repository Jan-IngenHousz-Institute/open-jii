"""Tests for enrich.backend_client (HMAC signing, batching, error paths)."""

from __future__ import annotations

import hashlib
import hmac
import json
import re

import pytest
import responses
from enrich.backend_client import BackendClient, BackendIntegrationError

BASE_URL = "https://api.example.test"
API_KEY_ID = "key-123"
SECRET = "shhh"


@pytest.fixture
def client() -> BackendClient:
    return BackendClient(base_url=BASE_URL, api_key_id=API_KEY_ID, webhook_secret=SECRET)


def _expected_signature(payload: dict, timestamp: int, secret: str = SECRET) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hmac.new(
        secret.encode("utf-8"),
        f"{timestamp}:{canonical}".encode(),
        hashlib.sha256,
    ).hexdigest()


class TestHmacSignature:
    def test_signature_is_stable_for_canonical_payload(self, client: BackendClient) -> None:
        payload = {"b": 2, "a": 1}  # unsorted intentionally
        ts = 1_700_000_000
        sig = client._create_hmac_signature(payload, ts)
        # Canonical JSON sorts keys, so {"b":2,"a":1} == {"a":1,"b":2} for signing.
        assert sig == _expected_signature({"a": 1, "b": 2}, ts)

    def test_signature_handles_non_ascii(self, client: BackendClient) -> None:
        payload = {"name": "öß🌱"}
        ts = 1_700_000_000
        sig = client._create_hmac_signature(payload, ts)
        # ensure_ascii=False is required so the JS side (which doesn't escape
        # non-ASCII either) computes the same digest.
        assert sig == _expected_signature(payload, ts)


@responses.activate
def test_get_user_metadata_happy_path(client: BackendClient) -> None:
    responses.add(
        responses.POST,
        f"{BASE_URL}/api/v1/users/metadata",
        json={
            "success": True,
            "users": [
                {"userId": "u1", "firstName": "Ada", "lastName": "Lovelace", "avatarUrl": "https://x/y"},
                {"userId": "u2", "firstName": "Linus", "lastName": "Pauling", "avatarUrl": None},
            ],
        },
        status=200,
    )

    result = client.get_user_metadata(["u1", "u2"])
    assert result == {
        "u1": {"firstName": "Ada", "lastName": "Lovelace", "avatarUrl": "https://x/y"},
        "u2": {"firstName": "Linus", "lastName": "Pauling", "avatarUrl": None},
    }
    # Verify the auth headers were attached.
    sent = responses.calls[0].request
    assert sent.headers["x-api-key-id"] == API_KEY_ID
    assert re.fullmatch(r"[a-f0-9]{64}", sent.headers["x-databricks-signature"])
    assert sent.headers["x-databricks-timestamp"].isdigit()


def test_get_user_metadata_empty_returns_empty(client: BackendClient) -> None:
    # Short-circuit before hitting the network.
    assert client.get_user_metadata([]) == {}


def test_get_user_metadata_filters_blank_ids(client: BackendClient) -> None:
    # All filtered out -> no HTTP call at all.
    assert client.get_user_metadata([None, "  ", ""]) == {}  # type: ignore[list-item]


def test_get_user_metadata_rejects_non_list(client: BackendClient) -> None:
    with pytest.raises(BackendIntegrationError, match="must be a list"):
        client.get_user_metadata("u1")  # type: ignore[arg-type]


def test_get_user_metadata_rejects_oversized_batch(client: BackendClient) -> None:
    with pytest.raises(BackendIntegrationError, match="Too many"):
        client.get_user_metadata([f"u{i}" for i in range(501)])


@responses.activate
def test_get_user_metadata_propagates_api_error(client: BackendClient) -> None:
    responses.add(
        responses.POST,
        f"{BASE_URL}/api/v1/users/metadata",
        json={"success": False, "message": "boom"},
        status=200,
    )
    with pytest.raises(BackendIntegrationError, match="boom"):
        client.get_user_metadata(["u1"])


@responses.activate
def test_get_user_metadata_propagates_http_error(client: BackendClient) -> None:
    responses.add(
        responses.POST,
        f"{BASE_URL}/api/v1/users/metadata",
        json={"error": "internal"},
        status=500,
    )
    with pytest.raises(BackendIntegrationError):
        client.get_user_metadata(["u1"])


@responses.activate
def test_execute_macro_batch_chunks_by_max_size(client: BackendClient) -> None:
    # Send 7 items with max_batch_size=3 -> 3 HTTP calls (3+3+1).
    responses.add(
        responses.POST,
        f"{BASE_URL}/api/v1/macros/execute-batch",
        json={"success": True, "results": []},
        status=200,
    )
    items = [{"id": str(i), "macro_id": "m", "data": {}} for i in range(7)]
    client.execute_macro_batch(items, max_batch_size=3)
    assert len(responses.calls) == 3


@responses.activate
def test_execute_macro_batch_chunk_failure_synthesizes_per_item_errors(client: BackendClient) -> None:
    # Two chunks: first succeeds, second 500s. Caller should get all 4 results,
    # with the failed chunk's items marked success=False.
    responses.add(
        responses.POST,
        f"{BASE_URL}/api/v1/macros/execute-batch",
        json={
            "success": True,
            "results": [
                {"id": "0", "macro_id": "m", "success": True, "output": {"x": 1}},
                {"id": "1", "macro_id": "m", "success": True, "output": {"x": 2}},
            ],
        },
        status=200,
    )
    responses.add(
        responses.POST,
        f"{BASE_URL}/api/v1/macros/execute-batch",
        json={"success": False, "message": "kaboom"},
        status=500,
    )

    items = [{"id": str(i), "macro_id": "m", "data": {}} for i in range(4)]
    response = client.execute_macro_batch(items, max_batch_size=2)

    assert len(response["results"]) == 4
    successes = [r for r in response["results"] if r.get("success")]
    failures = [r for r in response["results"] if not r.get("success")]
    assert len(successes) == 2
    assert len(failures) == 2
    assert all("Chunk failed" in (f.get("error") or "") for f in failures)
    assert "errors" in response


def test_execute_macro_batch_empty_short_circuits(client: BackendClient) -> None:
    assert client.execute_macro_batch([]) == {"results": []}


@responses.activate
def test_execute_macro_batch_sorts_same_macro_by_workbook_version(client: BackendClient) -> None:
    responses.add(
        responses.POST,
        f"{BASE_URL}/api/v1/macros/execute-batch",
        json={"success": True, "results": []},
        status=200,
    )
    client.execute_macro_batch(
        [
            {"id": "v2", "macro_id": "macro", "workbook_version_id": "version-2", "data": {}},
            {"id": "live", "macro_id": "macro", "data": {}},
            {"id": "v1", "macro_id": "macro", "workbook_version_id": "version-1", "data": {}},
        ]
    )

    body = responses.calls[0].request.body
    assert body is not None
    sent = json.loads(body)["items"]
    assert [item["id"] for item in sent] == ["live", "v1", "v2"]
