import pytest
from fastapi.testclient import TestClient
from app import app, validate_payload, workspace


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ASSISTANT_GATEWAY_TOKEN", "local-test-credential")
    monkeypatch.setenv("ASSISTANT_ALLOWED_MODELS", "test-model")
    return TestClient(app)


def test_rejects_unauthenticated_inference(client):
    assert client.post("/v1/chat/completions", json={}).status_code == 401


def test_fails_closed_without_gateway_credential(client, monkeypatch):
    monkeypatch.delenv("ASSISTANT_GATEWAY_TOKEN")
    assert client.post("/v1/chat/completions", json={}).status_code == 503


def test_cannot_choose_an_arbitrary_endpoint(client):
    response = client.post("/v1/chat/completions", json={"model": "../prod", "messages": []},
                           headers={"X-OpenJII-Gateway-Key": "local-test-credential"})
    assert response.status_code == 422


def test_rejects_excessive_output_budget(client):
    response = client.post("/v1/chat/completions", json={
        "model": "test-model", "messages": [{"role": "user", "content": "Hi"}], "max_tokens": 100000},
        headers={"X-OpenJII-Gateway-Key": "local-test-credential"})
    assert response.status_code == 422


def test_preserves_tool_messages_and_stream_flag(monkeypatch):
    monkeypatch.setenv("ASSISTANT_ALLOWED_MODELS", "test-model")
    messages = [{"role": "tool", "tool_call_id": "call-1", "content": "result"}]
    model, payload = validate_payload({"model": "test-model", "messages": messages, "stream": True})
    assert model == "test-model"
    assert payload == {"messages": messages, "stream": True, "max_tokens": 2048}


def test_refuses_production_configuration(monkeypatch):
    monkeypatch.setenv("ASSISTANT_DATABRICKS_HOST", "https://production.cloud.databricks.com")
    workspace.cache_clear()
    with pytest.raises(Exception) as error:
        workspace()
    assert error.value.status_code == 503


def test_streams_real_upstream_events_and_keeps_credentials_server_side(client, monkeypatch):
    import httpx
    import json
    import app as module
    from types import SimpleNamespace

    captured = []
    events = b'data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n\n'
    def upstream(request):
        captured.append(request)
        return httpx.Response(200, content=events, headers={"content-type": "text/event-stream"})
    async_client = httpx.AsyncClient
    monkeypatch.setattr(module, "workspace", lambda: SimpleNamespace(
        config=SimpleNamespace(authenticate=lambda: {"Authorization": "Bearer sdk-test-token"})))
    monkeypatch.setattr(module.httpx, "AsyncClient", lambda **kwargs:
                        async_client(transport=httpx.MockTransport(upstream), **kwargs))
    response = client.post("/v1/chat/completions", json={"model": "test-model",
        "messages": [{"role": "user", "content": "hello"}], "stream": True},
        headers={"X-OpenJII-Gateway-Key": "local-test-credential"})
    assert response.status_code == 200
    assert response.content == events
    assert str(captured[0].url).endswith('/serving-endpoints/test-model/invocations')
    assert captured[0].headers['Authorization'] == 'Bearer sdk-test-token'
    assert 'X-OpenJII-Gateway-Key' not in captured[0].headers
    assert 'model' not in json.loads(captured[0].content)


def test_provider_error_does_not_expose_upstream_payload(client, monkeypatch):
    import httpx
    import app as module
    from types import SimpleNamespace

    async_client = httpx.AsyncClient
    monkeypatch.setattr(module, "workspace", lambda: SimpleNamespace(
        config=SimpleNamespace(authenticate=lambda: {"Authorization": "Bearer sdk-test-token"})))
    monkeypatch.setattr(module.httpx, "AsyncClient", lambda **kwargs:
                        async_client(transport=httpx.MockTransport(lambda request:
                            httpx.Response(403, text='private provider diagnostic')), **kwargs))
    response = client.post("/v1/chat/completions", json={"model": "test-model",
        "messages": [{"role": "user", "content": "hello"}]},
        headers={"X-OpenJII-Gateway-Key": "local-test-credential"})
    assert response.status_code == 503
    assert 'private provider diagnostic' not in response.text


@pytest.mark.parametrize("model", ["databricks-qwen3-next-80b-a3b-instruct", "databricks-gpt-oss-120b"])
def test_default_configuration_rejects_disallowed_models(client, monkeypatch, model):
    monkeypatch.delenv("ASSISTANT_ALLOWED_MODELS", raising=False)
    response = client.post("/v1/agent/turns", json={
        "protocolVersion": 1, "model": model,
        "messages": [{"role": "user", "content": "Hello"}],
        "tools": [], "limits": {"maxToolRounds": 2, "maxOutputTokens": 100}},
        headers={"X-OpenJII-Gateway-Key": "local-test-credential"})
    assert response.status_code == 422
    assert response.json()["detail"] == "The requested model is not enabled for this gateway."


def test_luna_tool_calls_disable_unsupported_reasoning(monkeypatch):
    import asyncio
    import json
    import httpx
    import app as module
    from types import SimpleNamespace

    monkeypatch.setenv("ASSISTANT_ALLOWED_MODELS", "databricks-gpt-5-6-luna")
    monkeypatch.setattr(module, "workspace", lambda: SimpleNamespace(
        config=SimpleNamespace(authenticate=lambda: {})))
    async_client = httpx.AsyncClient

    def upstream(request):
        payload = json.loads(request.content)
        assert payload["reasoning_effort"] == "none"
        assert payload["tools"][0]["function"]["name"] == "search_knowledge"
        return httpx.Response(200, json={"choices": [{"message": {"content": "Ready"}}]})

    monkeypatch.setattr(module.httpx, "AsyncClient", lambda **kwargs:
                        async_client(transport=httpx.MockTransport(upstream), **kwargs))
    result = asyncio.run(module.complete_model("databricks-gpt-5-6-luna", {
        "messages": [{"role": "user", "content": "Find docs"}],
        "tools": [{"type": "function", "function": {"name": "search_knowledge"}}],
        "max_tokens": 100,
    }))
    assert result["choices"][0]["message"]["content"] == "Ready"
