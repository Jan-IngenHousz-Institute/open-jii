import asyncio
import json

import mlflow

from agent_runtime import advance, start_state
from app import validate_payload
from tracing import configure_tracing


def test_persists_nested_trace_without_secrets_or_content(tmp_path, monkeypatch):
    monkeypatch.setenv('ASSISTANT_TRACING_ENABLED', 'true')
    monkeypatch.setenv('ASSISTANT_TRACE_CONTENT', 'false')
    monkeypatch.setenv('MLFLOW_TRACKING_URI', f'sqlite:///{tmp_path}/traces.db')
    monkeypatch.setenv('MLFLOW_EXPERIMENT_NAME', 'trace-contract-test')
    monkeypatch.delenv('MLFLOW_EXPERIMENT_ID', raising=False)
    monkeypatch.setenv('ASSISTANT_GATEWAY_TOKEN', 'never-log-this-key')
    monkeypatch.setenv('ASSISTANT_ALLOWED_MODELS', 'test-model')
    configure_tracing.cache_clear()
    state = start_state({'protocolVersion': 1, 'model': 'test-model',
        'messages': [{'role': 'user', 'content': 'private-research-text'}],
        'tools': [{'type': 'function', 'function': {'name': 'search_knowledge', 'parameters': {}}}],
        'limits': {'maxToolRounds': 1, 'maxOutputTokens': 100, 'maxToolCallsPerRound': 1, 'maxTotalTokens': 100_000}}, validate_payload)
    async def complete(model, payload):
        return {'choices': [{'message': {'role': 'assistant', 'content': None, 'tool_calls': [
            {'id': 'call-1', 'type': 'function', 'function': {'name': 'search_knowledge', 'arguments': '{"query":"private-research-text"}'}}]}}],
                'usage': {'prompt_tokens': 9, 'completion_tokens': 3}}
    try:
        result = asyncio.run(advance(state, complete))
        mlflow.flush_trace_async_logging()
        trace = mlflow.get_trace(mlflow.get_last_active_trace_id())
        assert trace is not None
        assert {s.name for s in trace.data.spans} == {'openjii.agent.step', 'databricks.model'}
        serialized = json.dumps(trace.to_dict())
        assert 'never-log-this-key' not in serialized
        assert 'private-research-text' not in serialized
        assert result['continuationToken'] not in serialized
        assert 'input_tokens' in serialized
        assert state['turnId'] in serialized
    finally:
        configure_tracing.cache_clear()
