"""Tests for enrich.backend_client (HMAC signing, batching, error paths)."""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

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


def test_execute_macro_batch_caps_concurrency_and_preserves_chunk_order() -> None:
    lock = threading.Lock()
    both_requests_started = threading.Event()
    active_requests = 0
    max_active_requests = 0

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            nonlocal active_requests, max_active_requests

            body_length = int(self.headers["Content-Length"])
            payload = json.loads(self.rfile.read(body_length))
            item = payload["items"][0]

            with lock:
                active_requests += 1
                max_active_requests = max(max_active_requests, active_requests)
                if active_requests == 2:
                    both_requests_started.set()

            assert both_requests_started.wait(timeout=1)
            if item["id"] == "first":
                time.sleep(0.05)

            if item["id"] == "failed":
                status = 503
                response = json.dumps({"success": False, "message": "overloaded"}).encode()
            else:
                status = 200
                response = json.dumps(
                    {
                        "success": True,
                        "results": [
                            {
                                "id": item["id"],
                                "macro_id": item["macro_id"],
                                "success": True,
                                "output": item["data"],
                            }
                        ],
                    }
                ).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)

            with lock:
                active_requests -= 1

        def log_message(self, format: str, *args) -> None:
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    try:
        concurrent_client = BackendClient(
            base_url=f"http://127.0.0.1:{server.server_port}",
            api_key_id=API_KEY_ID,
            webhook_secret=SECRET,
        )
        response = concurrent_client.execute_macro_batch(
            [
                {"id": "first", "macro_id": "macro", "data": {"value": 1}},
                {"id": "second", "macro_id": "macro", "data": {"value": 2}},
                {"id": "failed", "macro_id": "macro", "data": {"value": 3}},
            ],
            max_batch_size=1,
            max_concurrency=2,
        )
    finally:
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=1)

    assert max_active_requests == 2
    assert [result["id"] for result in response["results"]] == ["first", "second", "failed"]
    successes = [result for result in response["results"] if result["success"]]
    assert [result["output"] for result in successes] == [
        {"value": 1},
        {"value": 2},
    ]
    failure = response["results"][-1]
    assert failure["success"] is False
    assert "Chunk failed" in failure["error"]
