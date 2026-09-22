import json
import time

import pytest
from fastapi.testclient import TestClient

import app as server
from agent_runtime import cipher

HEADERS = {"X-OpenJII-Gateway-Key": "test-server-secret"}
TOOL = {"type": "function", "function": {"name": "search_knowledge", "parameters": {"type": "object"}}}


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setattr("skill_library.SKILLS_ROOT", tmp_path)
    monkeypatch.setenv("ASSISTANT_GATEWAY_TOKEN", "test-server-secret")
    monkeypatch.setenv("ASSISTANT_ALLOWED_MODELS", "test-model")
    return TestClient(server.app)


def request_body(rounds=2):
    return {"protocolVersion": 1, "model": "test-model", "messages": [{"role": "user", "content": "Find sources"}],
            "tools": [TOOL], "limits": {"maxToolRounds": rounds, "maxOutputTokens": 100, "maxToolCallsPerRound": 2, "maxTotalTokens": 100_000}}


def tool_response(call_id="call-1", name="search_knowledge"):
    return {"choices": [{"message": {"role": "assistant", "content": None, "tool_calls": [
        {"id": call_id, "type": "function", "function": {"name": name, "arguments": '{"query":"light"}'}}]}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5}}


def result_body(token):
    return {"protocolVersion": 1, "continuationToken": token,
            "results": [{"id": "call-1", "name": "search_knowledge", "status": "completed", "result": {"text": "source"}}]}


def test_turn_resumes_with_scoped_tool_result_and_cumulative_usage(client, monkeypatch):
    calls = []
    async def complete(model, payload):
        calls.append(payload)
        if len(calls) == 1:
            return tool_response()
        assert payload["messages"][-1] == {"role": "tool", "tool_call_id": "call-1", "content": '{"text": "source"}'}
        return {"choices": [{"message": {"role": "assistant", "content": "Answer with source"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 20, "completion_tokens": 6}}
    monkeypatch.setattr(server, "complete_model", complete)
    first = client.post('/v1/agent/turns', json=request_body(), headers=HEADERS)
    assert first.status_code == 200
    token = first.json()["continuationToken"]
    assert "Find sources" not in token
    done = client.post('/v1/agent/turns/continue', json=result_body(token), headers=HEADERS)
    assert done.json() == {"status": "completed", "content": "Answer with source", "stopReason": "stop",
                           "usage": {"inputTokens": 30, "outputTokens": 11}, "usageComplete": True,
                           "modelProfile": first.json()["modelProfile"],
                           "skillLibrary": first.json()["skillLibrary"]}
    assert len(calls) == 2


def test_profile_change_rejects_resume_before_inference(client, monkeypatch):
    from model_profiles import PROFILES

    calls = []
    async def complete(model, payload):
        calls.append(payload)
        return tool_response()
    monkeypatch.setattr(server, "complete_model", complete)
    first = client.post('/v1/agent/turns', json=request_body(), headers=HEADERS).json()
    state = json.loads(cipher().decrypt(first["continuationToken"].encode()))
    assert state["modelProfile"] == first["modelProfile"]
    monkeypatch.setitem(PROFILES, "test-model", {"maxOutputTokens": 50})
    response = client.post('/v1/agent/turns/continue',
                           json=result_body(first["continuationToken"]), headers=HEADERS)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "INVALID_CONTINUATION"
    assert response.json()["detail"]["usage"] == {"inputTokens": 10, "outputTokens": 5}
    assert response.json()["detail"]["usageComplete"] is True
    assert len(calls) == 1


@pytest.mark.parametrize("mutation", ["tamper", "expired", "wrong-result", "duplicate-result"])
def test_invalid_continuations_never_reach_model(client, monkeypatch, mutation):
    calls = []
    async def complete(model, payload):
        calls.append(payload)
        return tool_response()
    monkeypatch.setattr(server, "complete_model", complete)
    token = client.post('/v1/agent/turns', json=request_body(), headers=HEADERS).json()["continuationToken"]
    body = result_body(token)
    if mutation == 'tamper':
        body['continuationToken'] = token[:40] + 'AAAA' + token[44:]
    elif mutation == 'expired':
        state = json.loads(cipher().decrypt(token.encode()))
        state['expiresAt'] = int(time.time()) - 1
        body['continuationToken'] = cipher().encrypt(json.dumps(state).encode()).decode()
    elif mutation == 'wrong-result':
        body['results'][0]['name'] = 'draft_entity'
    else:
        body['results'] *= 2
    response = client.post('/v1/agent/turns/continue', json=body, headers=HEADERS)
    assert response.status_code == 422
    assert len(calls) == 1


def test_python_enforces_round_limit(client, monkeypatch):
    calls = []
    async def complete(model, payload):
        calls.append(payload)
        return tool_response(f'call-{len(calls)}')
    monkeypatch.setattr(server, "complete_model", complete)
    token = client.post('/v1/agent/turns', json=request_body(rounds=1), headers=HEADERS).json()['continuationToken']
    response = client.post('/v1/agent/turns/continue', json=result_body(token), headers=HEADERS)
    assert response.status_code == 422
    assert response.json()['detail']['code'] == 'TOOL_LOOP_LIMIT'


def test_unknown_model_tool_fails_before_execution(client, monkeypatch):
    async def complete(model, payload):
        return tool_response(name='delete_everything')
    monkeypatch.setattr(server, "complete_model", complete)
    response = client.post('/v1/agent/turns', json=request_body(), headers=HEADERS)
    assert response.status_code == 502
    assert response.json()['detail']['code'] == 'PROVIDER_INVALID_RESPONSE'


def test_turn_routes_require_backend_auth(client):
    assert client.post('/v1/agent/turns', json=request_body()).status_code == 401
    assert client.post('/v1/agent/turns/continue', json={}).status_code == 401


def test_databricks_content_blocks_exclude_reasoning(client, monkeypatch):
    async def complete(model, payload):
        return {"choices": [{"message": {"role": "assistant", "content": [
            {"type": "reasoning", "summary": [{"type": "summary_text", "text": "internal reasoning"}]},
            {"type": "text", "text": "Grounded answer."}]}, "finish_reason": "stop"}]}
    monkeypatch.setattr(server, "complete_model", complete)
    response = client.post('/v1/agent/turns', json=request_body(), headers=HEADERS)
    assert response.status_code == 200
    assert response.json()['content'] == 'Grounded answer.'
    assert 'internal reasoning' not in response.text


def test_failed_turn_reports_spent_tokens(client, monkeypatch):
    async def complete(model, payload):
        return tool_response(name='unknown_tool')
    monkeypatch.setattr(server, "complete_model", complete)
    response = client.post('/v1/agent/turns', json=request_body(), headers=HEADERS)
    assert response.status_code == 502
    detail = response.json()['detail']
    assert detail['usage'] == {'inputTokens': 10, 'outputTokens': 5}
    assert detail['usageComplete'] is True


def test_transport_failure_preserves_prior_usage_as_lower_bound(client, monkeypatch):
    from fastapi import HTTPException
    calls = 0
    async def complete(model, payload):
        nonlocal calls
        calls += 1
        if calls == 1:
            return tool_response()
        raise HTTPException(503, {'code': 'PROVIDER_UNAVAILABLE', 'message': 'Unavailable'})
    monkeypatch.setattr(server, "complete_model", complete)
    token = client.post('/v1/agent/turns', json=request_body(), headers=HEADERS).json()['continuationToken']
    response = client.post('/v1/agent/turns/continue', json=result_body(token), headers=HEADERS)
    assert response.status_code == 503
    assert response.json()['detail']['usage'] == {'inputTokens': 10, 'outputTokens': 5}
    assert response.json()['detail']['usageComplete'] is False


def test_budget_rejects_large_prompt_before_provider(client, monkeypatch):
    async def complete(model, payload):
        pytest.fail("Provider must not be called when prompt cannot fit")
    monkeypatch.setattr(server, "complete_model", complete)
    body = request_body()
    body["limits"]["maxTotalTokens"] = 100
    response = client.post('/v1/agent/turns', json=body, headers=HEADERS)
    assert response.status_code == 422
    assert response.json()['detail']['code'] == 'TOOL_LOOP_LIMIT'
    assert response.json()['detail']['usageComplete'] is True


def test_budget_stops_continuation_when_measured_usage_exhausts_reservation(client, monkeypatch):
    calls = 0
    async def complete(model, payload):
        nonlocal calls
        calls += 1
        value = tool_response()
        value['usage'] = {'prompt_tokens': 4_995, 'completion_tokens': 5}
        return value
    monkeypatch.setattr(server, "complete_model", complete)
    body = request_body()
    body['limits']['maxTotalTokens'] = 5_000
    first = client.post('/v1/agent/turns', json=body, headers=HEADERS)
    assert first.status_code == 200
    response = client.post('/v1/agent/turns/continue', json=result_body(first.json()['continuationToken']), headers=HEADERS)
    assert response.status_code == 422
    assert calls == 1
    assert response.json()['detail']['usage'] == {'inputTokens': 4_995, 'outputTokens': 5}


def test_budget_reports_provider_overrun_without_returning_answer(client, monkeypatch):
    async def complete(model, payload):
        return {'choices': [{'message': {'role': 'assistant', 'content': 'Answer'}}],
                'usage': {'prompt_tokens': 5_001, 'completion_tokens': 1}}
    monkeypatch.setattr(server, "complete_model", complete)
    body = request_body()
    body['limits']['maxTotalTokens'] = 5_000
    response = client.post('/v1/agent/turns', json=body, headers=HEADERS)
    assert response.status_code == 422
    assert response.json()['detail']['usage'] == {'inputTokens': 5_001, 'outputTokens': 1}
    assert response.json()['detail']['usageComplete'] is True


def test_budget_reduces_output_allowance_before_call(client, monkeypatch):
    async def complete(model, payload):
        assert 0 < payload['max_tokens'] < 2_000
        return {'choices': [{'message': {'role': 'assistant', 'content': 'Answer'}}],
                'usage': {'prompt_tokens': 100, 'completion_tokens': 1}}
    monkeypatch.setattr(server, 'complete_model', complete)
    body = request_body()
    body['limits'].update(maxTotalTokens=2_000, maxOutputTokens=2_000)
    assert client.post('/v1/agent/turns', json=body, headers=HEADERS).status_code == 200


@pytest.mark.parametrize('budget', [None, 0, True, 100_001])
def test_invalid_turn_budget_is_rejected(client, budget):
    body = request_body()
    body['limits']['maxTotalTokens'] = budget
    response = client.post('/v1/agent/turns', json=body, headers=HEADERS)
    assert response.status_code == 422
    assert response.json()['detail']['code'] == 'INVALID_REQUEST'


def test_missing_endpoint_is_explicit_and_does_not_consume_reservation(client, monkeypatch):
    from fastapi import HTTPException
    async def complete(model, payload):
        raise HTTPException(503, {'code': 'PROVIDER_MODEL_UNAVAILABLE',
            'message': 'No callable model endpoint.', 'inferenceNotStarted': True})
    monkeypatch.setattr(server, 'complete_model', complete)
    response = client.post('/v1/agent/turns', json=request_body(), headers=HEADERS)
    assert response.status_code == 503
    assert response.json()['detail']['code'] == 'PROVIDER_MODEL_UNAVAILABLE'
    assert response.json()['detail']['usage'] == {'inputTokens': 0, 'outputTokens': 0}
    assert response.json()['detail']['usageComplete'] is True
