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
    monkeypatch.delenv("ASSISTANT_POC_UNLIMITED_TOKENS", raising=False)
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
    assert response.json()['detail']['code'] == 'TOKEN_BUDGET_EXCEEDED'
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
    assert response.json()['detail']['code'] == 'TOKEN_BUDGET_EXCEEDED'
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
    assert response.json()['detail']['code'] == 'TOKEN_BUDGET_EXCEEDED'
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


@pytest.mark.parametrize('changed', ['messages', 'tools', 'model', 'profile', 'count', 'tokens'])
def test_measured_prefix_mismatch_falls_back_to_initial_byte_reservation(changed):
    import copy
    from agent_runtime import estimate_prompt_tokens, prompt_prefix_hash
    state = {'model': 'test-model', 'modelProfile': {'version': 1}, 'tools': [copy.deepcopy(TOOL)],
             'messages': [{'role': 'user', 'content': 'Existing research context. ' * 100}]}
    state['promptAccounting'] = {'inputTokens': 100, 'messageCount': 1, 'prefixHash': prompt_prefix_hash(state, 1)}
    assert estimate_prompt_tokens(state) < estimate_prompt_tokens({key: value for key, value in state.items()
                                                                 if key != 'promptAccounting'})
    if changed == 'messages': state['messages'][0]['content'] += 'Changed'
    elif changed == 'tools': state['tools'][0]['function']['description'] = 'Changed'
    elif changed == 'model': state['model'] = 'changed-model'
    elif changed == 'profile': state['modelProfile']['version'] = 2
    elif changed == 'count': state['promptAccounting']['messageCount'] = True
    elif changed == 'tokens': state['promptAccounting']['inputTokens'] = -1
    estimate = estimate_prompt_tokens(state)
    del state['promptAccounting']
    assert estimate == estimate_prompt_tokens(state)


def test_measured_prefix_reserves_utf8_new_messages_without_losing_text():
    from agent_runtime import estimate_prompt_tokens, prompt_prefix_hash
    state = {'model': 'test-model', 'tools': [TOOL], 'messages': [{'role': 'user', 'content': 'Existing text'}]}
    state['promptAccounting'] = {'inputTokens': 100, 'messageCount': 1, 'prefixHash': prompt_prefix_hash(state, 1)}
    before = estimate_prompt_tokens(state)
    state['messages'].append({'role': 'tool', 'tool_call_id': 'measurement', 'content': '葉 🌱 µmol'})
    assert estimate_prompt_tokens(state) - before >= len('葉 🌱 µmol'.encode())
    assert state['messages'][-1]['content'] == '葉 🌱 µmol'


def test_calibrated_preflight_rejects_large_new_result_without_inference(client, monkeypatch):
    calls = []
    async def complete(model, payload):
        calls.append(payload)
        return tool_response()
    monkeypatch.setattr(server, 'complete_model', complete)
    body = request_body()
    body['limits']['maxTotalTokens'] = 5000
    first = client.post('/v1/agent/turns', json=body, headers=HEADERS)
    continuation = result_body(first.json()['continuationToken'])
    continuation['results'][0]['result'] = {'text': '葉' * 2000}
    failed = client.post('/v1/agent/turns/continue', json=continuation, headers=HEADERS)
    assert failed.status_code == 422
    assert failed.json()['detail']['code'] == 'TOKEN_BUDGET_EXCEEDED'
    assert failed.json()['detail']['usage'] == {'inputTokens': 10, 'outputTokens': 5}
    assert len(calls) == 1


def test_missing_usage_after_measured_step_cannot_reuse_old_accounting(client, monkeypatch):
    calls = []
    async def complete(model, payload):
        calls.append(payload)
        value = tool_response(call_id=f'call-{len(calls)}')
        if len(calls) == 2:
            del value['usage']
        return value
    monkeypatch.setattr(server, 'complete_model', complete)
    first = client.post('/v1/agent/turns', json=request_body(rounds=3), headers=HEADERS).json()
    second = client.post('/v1/agent/turns/continue', json=result_body(first['continuationToken']), headers=HEADERS).json()
    continuation = result_body(second['continuationToken'])
    continuation['results'][0]['id'] = 'call-2'
    failed = client.post('/v1/agent/turns/continue', json=continuation, headers=HEADERS)
    assert failed.status_code == 422
    assert failed.json()['detail']['usageComplete'] is False
    assert len(calls) == 2


def enable_local_unlimited(monkeypatch):
    monkeypatch.setenv('ASSISTANT_POC_UNLIMITED_TOKENS', 'true')
    monkeypatch.setenv('ASSISTANT_RUNTIME_MODE', 'local')
    monkeypatch.delenv('DATABRICKS_APP_NAME', raising=False)


@pytest.mark.parametrize('flag', [None, 'false'])
def test_token_enforcement_defaults_on(monkeypatch, flag):
    from agent_runtime import token_enforcement_mode
    monkeypatch.setenv('ASSISTANT_RUNTIME_MODE', 'local')
    if flag is None: monkeypatch.delenv('ASSISTANT_POC_UNLIMITED_TOKENS', raising=False)
    else: monkeypatch.setenv('ASSISTANT_POC_UNLIMITED_TOKENS', flag)
    assert token_enforcement_mode() == 'enforced'


@pytest.mark.parametrize('runtime,app_name', [(None, None), ('production', None), ('local', 'deployed'), ('local', '')])
def test_unlimited_tokens_refused_outside_explicit_local_runtime(client, monkeypatch, runtime, app_name):
    monkeypatch.setenv('ASSISTANT_POC_UNLIMITED_TOKENS', 'true')
    for key, value in [('ASSISTANT_RUNTIME_MODE', runtime), ('DATABRICKS_APP_NAME', app_name)]:
        if value is None: monkeypatch.delenv(key, raising=False)
        else: monkeypatch.setenv(key, value)
    async def complete(*args): pytest.fail('Invalid mode must not invoke provider')
    monkeypatch.setattr(server, 'complete_model', complete)
    failed = client.post('/v1/agent/turns', json=request_body(), headers=HEADERS)
    assert failed.status_code == 503
    assert failed.json()['detail']['code'] == 'INVALID_RUNTIME_CONFIGURATION'


def test_local_unlimited_skips_preflight_and_total_cap_but_keeps_usage_and_output_cap(client, monkeypatch):
    enable_local_unlimited(monkeypatch)
    calls = []
    async def complete(model, payload):
        calls.append(payload)
        assert payload['max_tokens'] == 100
        value = tool_response() if len(calls) == 1 else {
            'choices': [{'message': {'role': 'assistant', 'content': 'Done'}}]}
        value['usage'] = {'prompt_tokens': 110_000, 'completion_tokens': 80}
        return value
    monkeypatch.setattr(server, 'complete_model', complete)
    body = request_body()
    body['limits']['maxTotalTokens'] = 1
    first = client.post('/v1/agent/turns', json=body, headers=HEADERS)
    assert first.status_code == 200
    state = json.loads(cipher().decrypt(first.json()['continuationToken'].encode()))
    assert state['tokenEnforcement'] == 'local_poc_unlimited'
    done = client.post('/v1/agent/turns/continue', json=result_body(first.json()['continuationToken']), headers=HEADERS)
    assert done.status_code == 200
    assert done.json()['usage'] == {'inputTokens': 220_000, 'outputTokens': 160}
    assert done.json()['usageComplete'] is True
    assert len(calls) == 2


@pytest.mark.parametrize('started_unlimited', [True, False])
def test_changed_token_enforcement_rejects_continuation(client, monkeypatch, started_unlimited):
    enable_local_unlimited(monkeypatch)
    monkeypatch.setenv('ASSISTANT_POC_UNLIMITED_TOKENS', str(started_unlimited).lower())
    calls = []
    async def complete(*args):
        calls.append(1)
        return tool_response()
    monkeypatch.setattr(server, 'complete_model', complete)
    first = client.post('/v1/agent/turns', json=request_body(), headers=HEADERS).json()
    monkeypatch.setenv('ASSISTANT_POC_UNLIMITED_TOKENS', str(not started_unlimited).lower())
    failed = client.post('/v1/agent/turns/continue', json=result_body(first['continuationToken']), headers=HEADERS)
    assert failed.status_code == 409
    assert failed.json()['detail']['code'] == 'INVALID_CONTINUATION'
    assert len(calls) == 1


@pytest.mark.parametrize('guard', ['rounds', 'missing_usage'])
def test_local_unlimited_preserves_other_loop_guards(client, monkeypatch, guard):
    enable_local_unlimited(monkeypatch)
    calls = []
    async def complete(*args):
        calls.append(1)
        value = tool_response(call_id=f'call-{len(calls)}')
        if guard == 'missing_usage': del value['usage']
        return value
    monkeypatch.setattr(server, 'complete_model', complete)
    first = client.post('/v1/agent/turns', json=request_body(rounds=1), headers=HEADERS).json()
    failed = client.post('/v1/agent/turns/continue', json=result_body(first['continuationToken']), headers=HEADERS)
    assert failed.status_code == 422
    assert failed.json()['detail']['code'] == 'TOOL_LOOP_LIMIT'
    assert len(calls) == (1 if guard == 'missing_usage' else 2)
