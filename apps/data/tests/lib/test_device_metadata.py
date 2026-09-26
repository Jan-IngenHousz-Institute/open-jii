"""Registry enrichment must distinguish unknown devices from failed lookups."""

import json
from typing import Any

import pytest
import requests
import responses
from enrich import backend_client
from enrich.backend_client import BackendClient, BackendIntegrationError
from enrich.device_metadata import _fetch_device_registry

REGISTRY_URL = "https://api.example.test/api/v1/iot/devices/registry"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> BackendClient:
    monkeypatch.setattr(BackendClient, "DEVICE_REGISTRY_RETRY_DELAYS", (0, 0))
    return BackendClient("https://api.example.test", "test-key", "test-secret")


@pytest.mark.parametrize("count", [0, 1, 500, 501, 1001, 12737])
@responses.activate
def test_registry_enrichment_resolves_every_device_across_batches(client: BackendClient, count: int) -> None:
    def registry(request: Any) -> tuple[int, dict[str, str], str]:
        names = json.loads(request.body)["thingNames"]
        assert 1 <= len(names) <= 500
        assert request.headers["x-api-key-id"] == "test-key"
        return (
            200,
            {},
            json.dumps(
                {
                    "success": True,
                    "devices": [{"thingName": name, "id": name, "deviceType": "ambyte"} for name in names],
                }
            ),
        )

    responses.add_callback(responses.POST, REGISTRY_URL, callback=registry)
    names = [f"ambyte_{i}" for i in range(count)]

    result = _fetch_device_registry(names, client)

    assert set(result) == set(names)
    assert all(device["deviceType"] == "ambyte" for device in result.values())
    assert len(responses.calls) == (count + 499) // 500
    sent = []
    for call in responses.calls:
        body = call.request.body
        assert body is not None
        sent.extend(json.loads(body)["thingNames"])
    assert sent == names


@responses.activate
def test_registry_enrichment_deduplicates_and_keeps_unknown_devices_absent(client: BackendClient) -> None:
    responses.add(
        responses.POST,
        REGISTRY_URL,
        json={"success": True, "devices": [{"thingName": "known", "deviceType": "ambyte"}]},
    )

    result = _fetch_device_registry(["known", "", "  ", "known", "unknown"], client)

    assert set(result) == {"known"}
    body = responses.calls[0].request.body
    assert body is not None
    assert json.loads(body) == {"thingNames": ["known", "unknown"]}


@responses.activate
def test_registry_client_does_not_return_partial_results_after_chunk_failure(
    client: BackendClient,
) -> None:
    responses.add(responses.POST, REGISTRY_URL, json={"success": True, "devices": []})
    responses.add(responses.POST, REGISTRY_URL, status=503)

    with pytest.raises(BackendIntegrationError):
        client.get_device_registry([f"thing_{i}" for i in range(1001)])

    assert len(responses.calls) == 4


@pytest.mark.parametrize("payload", [{"success": True}, {"success": True, "devices": None}])
@responses.activate
def test_registry_enrichment_rejects_malformed_responses_instead_of_erasing_metadata(
    client: BackendClient, payload: dict[str, Any]
) -> None:
    responses.add(responses.POST, REGISTRY_URL, json=payload)

    with pytest.raises(BackendIntegrationError, match="expected 'devices' to be a list"):
        client.get_device_registry(["known"])

    assert len(responses.calls) == 1


@pytest.mark.parametrize("failure", [429, 503, requests.Timeout("timed out")])
@responses.activate
def test_registry_client_retries_transient_failures(client: BackendClient, failure: int | Exception) -> None:
    if isinstance(failure, int):
        responses.add(responses.POST, REGISTRY_URL, status=failure)
    else:
        responses.add(responses.POST, REGISTRY_URL, body=failure)
    responses.add(
        responses.POST,
        REGISTRY_URL,
        json={"success": True, "devices": [{"thingName": "known", "deviceType": "ambyte"}]},
    )

    assert _fetch_device_registry(["known"], client)["known"]["deviceType"] == "ambyte"
    assert len(responses.calls) == 2


@responses.activate
def test_registry_failure_stays_nonfatal_for_ingestion_but_logs_degraded_metadata(
    client: BackendClient, caplog: pytest.LogCaptureFixture
) -> None:
    responses.add(responses.POST, REGISTRY_URL, status=503)

    assert _fetch_device_registry(["known"], client) == {}
    assert len(responses.calls) == 3
    assert "Device registry enrichment failed for 1 client IDs" in caplog.text
    assert "family totals may be incomplete" in caplog.text
    assert caplog.records[0].levelname == "ERROR"


@responses.activate
def test_registry_client_does_not_retry_forbidden_requests(client: BackendClient) -> None:
    responses.add(responses.POST, REGISTRY_URL, status=403)

    with pytest.raises(BackendIntegrationError):
        client.get_device_registry(["known"])

    assert len(responses.calls) == 1


@responses.activate
def test_registry_client_stops_starting_chunks_when_lookup_budget_is_exhausted(
    client: BackendClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    clock = [0.0]
    monkeypatch.setattr(backend_client.time, "monotonic", lambda: clock[0])

    def slow_response(request: Any) -> tuple[int, dict[str, str], str]:
        clock[0] = client.DEVICE_REGISTRY_LOOKUP_BUDGET
        return 200, {}, json.dumps({"success": True, "devices": []})

    responses.add_callback(responses.POST, REGISTRY_URL, callback=slow_response)

    with pytest.raises(BackendIntegrationError, match="time budget exhausted"):
        client.get_device_registry([f"thing_{i}" for i in range(1001)])

    assert len(responses.calls) == 1


@responses.activate
def test_registry_client_wraps_non_object_responses(client: BackendClient) -> None:
    responses.add(responses.POST, REGISTRY_URL, json=[])

    with pytest.raises(BackendIntegrationError):
        client.get_device_registry(["known"])

    assert len(responses.calls) == 1


@responses.activate
def test_registry_enrichment_allows_a_successful_empty_registry(client: BackendClient) -> None:
    responses.add(responses.POST, REGISTRY_URL, json={"success": True, "devices": []})
    assert _fetch_device_registry(["unregistered"], client) == {}


@responses.activate
def test_registry_enrichment_skips_blank_names_without_a_request(client: BackendClient) -> None:
    assert _fetch_device_registry(["", "  "], client) == {}
    assert len(responses.calls) == 0
