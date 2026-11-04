from unittest.mock import Mock

import pytest
from enrich.backend_client import BackendClient, BackendIntegrationError, TransientBackendError


def test_classification_batches_deduplicate_and_require_complete_coverage(monkeypatch):
    client = BackendClient("https://unused.example", "id", "secret")
    ids = [f"experiment-{i}" for i in range(501)]
    request = Mock(
        side_effect=lambda path, payload, **kwargs: {
            "experiments": [
                {"experimentId": value, "numericKeys": ["height"]} for value in payload["experimentIds"]
            ]
        }
    )
    monkeypatch.setattr(client, "_make_request", request)
    assert len(client.get_numeric_question_keys([*ids, ids[0]])) == 501
    assert [len(call.kwargs) for call in request.call_args_list] == [1, 1]
    assert [len(call.args[1]["experimentIds"]) for call in request.call_args_list] == [500, 1]
    request.return_value = {"experiments": []}
    request.side_effect = None
    with pytest.raises(BackendIntegrationError, match="incomplete"):
        client.get_numeric_question_keys(ids[:1])


@pytest.mark.parametrize(
    "entries",
    [
        None,
        [{}],
        [{"experimentId": "e", "numericKeys": "height"}],
        [{"experimentId": "e", "numericKeys": [1]}],
        [{"experimentId": "e", "numericKeys": []}, {"experimentId": "e", "numericKeys": []}],
    ],
)
def test_bad_classification_is_not_treated_as_text(monkeypatch, entries):
    client = BackendClient("https://unused.example", "id", "secret")
    monkeypatch.setattr(client, "_make_request", Mock(return_value={"experiments": entries}))
    with pytest.raises(BackendIntegrationError):
        client.get_numeric_question_keys(["e"])


def test_transient_classification_failure_is_retried_but_not_swallowed(monkeypatch):
    client = BackendClient("https://unused.example", "id", "secret")
    request = Mock(side_effect=TransientBackendError("unavailable"))
    monkeypatch.setattr(client, "_make_request", request)
    monkeypatch.setattr("enrich.backend_client.time.sleep", lambda _: None)
    with pytest.raises(TransientBackendError):
        client.get_numeric_question_keys(["e"])
    assert request.call_count == 3
