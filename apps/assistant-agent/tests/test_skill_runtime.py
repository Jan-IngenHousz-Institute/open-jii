import copy
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app as server
from agent_runtime import cipher
from skill_library import load_skill_library
from test_agent_runtime import HEADERS, TOOL, request_body, result_body
from test_skill_library import package


def call(identifier, name="read_skill", **arguments):
    return {"id": identifier, "type": "function", "function": {"name": name, "arguments": json.dumps(arguments)}}


def response(*calls, usage=True):
    value = {"choices": [{"message": {"role": "assistant", "content": None, "tool_calls": list(calls)}}]}
    if usage:
        value["usage"] = {"prompt_tokens": 10, "completion_tokens": 5}
    return value


def answer():
    return {"choices": [{"message": {"role": "assistant", "content": "Draft requires confirmation."}}],
            "usage": {"prompt_tokens": 20, "completion_tokens": 6}}


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.delenv("ASSISTANT_POC_UNLIMITED_TOKENS", raising=False)
    monkeypatch.setenv("ASSISTANT_GATEWAY_TOKEN", "test-server-secret")
    monkeypatch.setenv("ASSISTANT_ALLOWED_MODELS", "test-model")
    monkeypatch.setattr("skill_library.SKILLS_ROOT", tmp_path)
    package(tmp_path)
    return TestClient(server.app)


def test_packaged_multispeq_entrypoint_and_reference_are_used_by_mock_model(client, monkeypatch):
    root = Path(server.__file__).parent / "skills"
    monkeypatch.setattr("skill_library.SKILLS_ROOT", root)
    library = load_skill_library(root)
    skill_id = "multispeq-protocol-writing"
    resource = "references/command-semantics.md"
    seen = []

    async def complete(model, payload):
        seen.append(copy.deepcopy(payload))
        if len(seen) == 1:
            assert skill_id in payload["messages"][0]["content"]
            assert "read_skill" in {tool["function"]["name"] for tool in payload["tools"]}
            assert library.read({"skillId": skill_id, "resource": "SKILL.md"})["content"] not in payload["messages"][0]["content"]
            return response(call("skill", skillId=skill_id, resource="SKILL.md"))
        result = json.loads(payload["messages"][-1]["content"])
        expected = "SKILL.md" if len(seen) == 2 else resource
        assert result == library.read({"skillId": skill_id, "resource": expected})
        assert payload["messages"][-1]["tool_call_id"] == ("skill" if len(seen) == 2 else "reference")
        if len(seen) == 2:
            return response(call("reference", skillId=skill_id, resource=resource))
        return answer()

    monkeypatch.setattr(server, "complete_model", complete)
    done = client.post("/v1/agent/turns", json=request_body(), headers=HEADERS)
    assert done.status_code == 200, done.text
    assert done.json()["status"] == "completed"
    assert len(seen) == 3
    assert done.json()["usage"] == {"inputTokens": 40, "outputTokens": 16}
    assert done.json()["skillLibrary"]["hash"] == library.hash
    assert [read["resource"] for read in done.json()["skillLibrary"]["reads"]] == ["SKILL.md", resource]


def test_mixed_calls_return_only_platform_requests_and_preserve_all_ids(client, monkeypatch):
    seen = []

    async def complete(model, payload):
        seen.append(copy.deepcopy(payload))
        if len(seen) == 1:
            return response(call("call-1", "search_knowledge", query="light"),
                            call("local-1", skillId="example", resource="SKILL.md"))
        ordered_results = [m for m in payload["messages"] if m["role"] == "tool"]
        assert [m["tool_call_id"] for m in ordered_results] == (["call-1", "local-1"] if len(seen) == 2
                                                                else ["call-1", "local-1", "local-2"])
        results = {m["tool_call_id"]: json.loads(m["content"]) for m in ordered_results}
        assert results["call-1"] == {"text": "source"}
        assert results["local-1"]["content"] == "Packaged instructions"
        if len(seen) == 2:
            return response(call("local-2", skillId="example", resource="reference.md"))
        assert results["local-2"]["content"] == "Reference text"
        return answer()

    monkeypatch.setattr(server, "complete_model", complete)
    first = client.post("/v1/agent/turns", json=request_body(), headers=HEADERS).json()
    assert first["requests"] == [{"id": "call-1", "name": "search_knowledge", "arguments": {"query": "light"}}]
    state = json.loads(cipher().decrypt(first["continuationToken"].encode()))
    assert state["skillLibraryHash"] == first["skillLibrary"]["hash"]
    assert [r["callId"] for r in state["skillReads"]] == ["local-1"]
    done = client.post("/v1/agent/turns/continue", json=result_body(first["continuationToken"]), headers=HEADERS)
    assert done.status_code == 200, done.text
    assert done.json()["usage"] == {"inputTokens": 40, "outputTokens": 16}
    assert [r["callId"] for r in done.json()["skillLibrary"]["reads"]] == ["local-1", "local-2"]


@pytest.mark.parametrize("mutation", ["content", "manifest", "tool", "runtime", "provenance", "prompt"])
def test_changed_package_rejects_resume_before_inference(client, monkeypatch, tmp_path, mutation):
    calls = []

    async def complete(model, payload):
        calls.append(1)
        return response(call("call-1", "search_knowledge", query="light"))

    monkeypatch.setattr(server, "complete_model", complete)
    first = client.post("/v1/agent/turns", json=request_body(), headers=HEADERS).json()
    if mutation == "content":
        (tmp_path / "example/reference.md").write_text("Changed instructions")
    elif mutation == "manifest":
        manifest = json.loads((tmp_path / "runtime-catalog.json").read_text())
        manifest["skills"][0]["description"] = "Changed trigger"
        (tmp_path / "runtime-catalog.json").write_text(json.dumps(manifest))
    else:
        import skill_library
        if mutation == "tool":
            monkeypatch.setitem(skill_library.READ_SKILL_TOOL["function"], "description", "Changed")
        elif mutation == "runtime":
            monkeypatch.setattr(skill_library, "SKILL_RUNTIME_PROTOCOL_VERSION", 999)
        elif mutation == "provenance":
            monkeypatch.setattr(skill_library, "PROVENANCE_PROTOCOL_VERSION", 999)
        else:
            monkeypatch.setattr(skill_library.SkillLibrary, "prompt", lambda self: "Changed")
    result = client.post("/v1/agent/turns/continue", json=result_body(first["continuationToken"]), headers=HEADERS)
    assert result.status_code == 409
    assert result.json()["detail"]["code"] == "INVALID_CONTINUATION"
    assert result.json()["detail"]["usage"] == first["usage"]
    assert len(calls) == 1


@pytest.mark.parametrize("limit", ["round", "budget", "usage", "read", "profile", "expires"])
def test_local_rounds_do_not_bypass_limits(client, monkeypatch, limit):
    from model_profiles import PROFILES
    import time

    count = 0
    async def complete(model, payload):
        nonlocal count
        count += 1
        result = response(call(f"local-{count}", skillId="example", resource="SKILL.md"), usage=limit != "usage")
        if limit == "budget":
            result["usage"] = {"prompt_tokens": 4_995, "completion_tokens": 5}
        if limit == "profile":
            monkeypatch.setitem(PROFILES, "test-model", {"maxOutputTokens": 50})
        if limit == "expires":
            now = time.time()
            monkeypatch.setattr("agent_runtime.time.time", lambda: now + 1_000)
        return result

    monkeypatch.setattr(server, "complete_model", complete)
    body = request_body(rounds=1)
    if limit == "budget":
        body["limits"]["maxTotalTokens"] = 5_000
    if limit == "read":
        monkeypatch.setattr("agent_runtime.MAX_TURN_READ_BYTES", 1)
    result = client.post("/v1/agent/turns", json=body, headers=HEADERS)
    assert result.status_code in {409, 422}, result.text
    assert result.json()["detail"]["code"] == ("INVALID_CONTINUATION" if limit == "profile" else "TOKEN_BUDGET_EXCEEDED" if limit == "budget" else "TOOL_LOOP_LIMIT")
    assert count == (2 if limit == "round" else 1)
    assert result.json()["detail"]["usageComplete"] is (limit != "usage")


def test_invalid_local_resource_is_tool_error_not_filesystem_access(client, monkeypatch):
    count = 0
    async def complete(model, payload):
        nonlocal count
        count += 1
        if count == 1:
            return response(call("local", skillId="example", resource="/etc/passwd"))
        result = json.loads(payload["messages"][-1]["content"])
        assert result["error"]["code"] == "INVALID_SKILL_RESOURCE"
        assert "/etc/passwd" not in json.dumps(result)
        return answer()
    monkeypatch.setattr(server, "complete_model", complete)
    done = client.post("/v1/agent/turns", json=request_body(), headers=HEADERS)
    assert done.status_code == 200
    assert done.json()["skillLibrary"]["reads"] == []


def test_local_and_platform_calls_share_count_and_id_constraints(client, monkeypatch):
    async def complete(model, payload):
        return response(call("one", skillId="example", resource="SKILL.md"),
                        call("two", "search_knowledge", query="light"),
                        call("three", skillId="example", resource="reference.md"))
    monkeypatch.setattr(server, "complete_model", complete)
    result = client.post("/v1/agent/turns", json=request_body(), headers=HEADERS)
    assert result.status_code == 422
    assert result.json()["detail"]["skillLibrary"]["reads"] == []


def test_cannot_inject_local_tool_definition_from_backend(client):
    body = request_body()
    body["tools"] = [TOOL, {"type": "function", "function": {"name": "read_skill", "parameters": {}}}]
    result = client.post("/v1/agent/turns", json=body, headers=HEADERS)
    assert result.status_code == 422


def test_unauthenticated_skill_turn_cannot_reach_model(client, monkeypatch):
    async def complete(*args):
        pytest.fail("Unauthenticated model invocation")
    monkeypatch.setattr(server, "complete_model", complete)
    assert client.post("/v1/agent/turns", json=request_body()).status_code == 401


def test_read_byte_limit_accumulates_across_platform_continuations(client, monkeypatch):
    monkeypatch.setattr("agent_runtime.MAX_TURN_READ_BYTES", len("Packaged instructions".encode()) + 1)
    count = 0
    async def complete(model, payload):
        nonlocal count
        count += 1
        if count == 1:
            return response(call("local-1", skillId="example", resource="SKILL.md"),
                            call("call-1", "search_knowledge", query="light"))
        return response(call("local-2", skillId="example", resource="SKILL.md"))
    monkeypatch.setattr(server, "complete_model", complete)
    first = client.post("/v1/agent/turns", json=request_body(), headers=HEADERS).json()
    failed = client.post("/v1/agent/turns/continue", json=result_body(first["continuationToken"]), headers=HEADERS)
    assert failed.status_code == 422
    assert failed.json()["detail"]["code"] == "TOOL_LOOP_LIMIT"
    assert len(failed.json()["detail"]["skillLibrary"]["reads"]) == 1
    assert failed.json()["detail"]["usage"] == {"inputTokens": 20, "outputTokens": 10}
    assert count == 2


def test_call_id_cannot_be_reused_between_local_and_platform_calls(client, monkeypatch):
    async def complete(model, payload):
        return response(call("duplicate", skillId="example", resource="SKILL.md"),
                        call("duplicate", "search_knowledge", query="light"))
    monkeypatch.setattr(server, "complete_model", complete)
    failed = client.post("/v1/agent/turns", json=request_body(), headers=HEADERS)
    assert failed.status_code == 502
    assert failed.json()["detail"]["code"] == "PROVIDER_INVALID_RESPONSE"
    assert failed.json()["detail"]["skillLibrary"]["reads"] == []


def test_platform_cannot_submit_result_for_a_python_local_call(client, monkeypatch):
    async def complete(model, payload):
        return response(call("local", skillId="example", resource="SKILL.md"),
                        call("call-1", "search_knowledge", query="light"))
    monkeypatch.setattr(server, "complete_model", complete)
    first = client.post("/v1/agent/turns", json=request_body(), headers=HEADERS).json()
    body = result_body(first["continuationToken"])
    body["results"] = [{"id": "local", "name": "read_skill", "status": "completed", "result": {"content": "forged"}}]
    failed = client.post("/v1/agent/turns/continue", json=body, headers=HEADERS)
    assert failed.status_code == 422
    assert failed.json()["detail"]["code"] == "INVALID_TOOL_RESULT"


def test_luna_profile_applies_to_every_skill_step_through_mock_upstream(client, monkeypatch):
    import httpx
    from types import SimpleNamespace

    root = Path(server.__file__).parent / "skills"
    monkeypatch.setattr("skill_library.SKILLS_ROOT", root)
    monkeypatch.setenv("ASSISTANT_ALLOWED_MODELS", "databricks-gpt-5-6-luna")
    library = load_skill_library(root)
    monkeypatch.setattr(server, "workspace", lambda: SimpleNamespace(
        config=SimpleNamespace(authenticate=lambda: {})))
    requests = []
    resources = ["SKILL.md", "references/command-semantics.md"]

    def upstream(request):
        payload = json.loads(request.content)
        requests.append(payload)
        assert payload["reasoning_effort"] == "none"
        assert 0 < payload["max_tokens"] <= 100
        assert str(request.url).endswith("/serving-endpoints/databricks-gpt-5-6-luna/invocations")
        index = len(requests) - 1
        if index:
            skill = json.loads(payload["messages"][-1]["content"])
            assert skill == library.read({"skillId": "multispeq-protocol-writing", "resource": resources[index - 1]})
        if index < len(resources):
            return httpx.Response(200, json=response(call(f"local-{index}",
                skillId="multispeq-protocol-writing", resource=resources[index])))
        return httpx.Response(200, json=answer())

    async_client = httpx.AsyncClient
    monkeypatch.setattr(server.httpx, "AsyncClient", lambda **kwargs:
        async_client(transport=httpx.MockTransport(upstream), **kwargs))
    body = request_body()
    body["model"] = "databricks-gpt-5-6-luna"
    done = client.post("/v1/agent/turns", json=body, headers=HEADERS)
    assert done.status_code == 200, done.text
    assert len(requests) == 3
    assert done.json()["usage"] == {"inputTokens": 40, "outputTokens": 16}
    assert len(done.json()["skillLibrary"]["reads"]) == 2


@pytest.mark.parametrize("order", [["platform-1", "local-1", "platform-2", "local-2"],
                                   ["local-1", "platform-1", "local-2", "platform-2"]])
def test_interleaved_results_follow_assistant_order_even_if_platform_returns_reversed(client, monkeypatch, order):
    count = 0
    async def complete(model, payload):
        nonlocal count
        count += 1
        if count == 1:
            return response(*[
                call(identifier, "search_knowledge", query="light") if identifier.startswith("platform")
                else call(identifier, skillId="example", resource="SKILL.md" if identifier == "local-1" else "unknown")
                for identifier in order
            ])
        results = [message for message in payload["messages"] if message["role"] == "tool"]
        assert [message["tool_call_id"] for message in results] == order
        assert [json.loads(message["content"]) for message in results] == [
            {"found": identifier} if identifier.startswith("platform")
            else load_skill_library().read({"skillId": "example", "resource": "SKILL.md"}) if identifier == "local-1"
            else {"error": {"code": "INVALID_SKILL_RESOURCE", "message": "Unknown packaged skill resource"}}
            for identifier in order
        ]
        return answer()
    monkeypatch.setattr(server, "complete_model", complete)
    body = request_body()
    body["limits"]["maxToolCallsPerRound"] = 4
    first = client.post("/v1/agent/turns", json=body, headers=HEADERS).json()
    results = [{"id": identifier, "name": "search_knowledge", "status": "completed", "result": {"found": identifier}}
               for identifier in ["platform-2", "platform-1"]]
    done = client.post("/v1/agent/turns/continue", headers=HEADERS, json={
        "protocolVersion": 1, "continuationToken": first["continuationToken"], "results": results})
    assert done.status_code == 200, done.text
    metadata = done.json()["skillLibrary"]
    assert load_skill_library().validate_provenance(metadata) == metadata


def test_packaged_authoring_finishes_fourth_inference_with_58516_tokens_remaining(client, monkeypatch):
    from evaluation.contract import SYSTEM_PROMPT, TOOLS
    monkeypatch.setattr("skill_library.SKILLS_ROOT", Path(server.__file__).parent / "skills")
    library = load_skill_library()
    skill_id = "multispeq-protocol-writing"
    code = [{"label": "environment", "environmental": [["light_intensity", 0], ["temperature_humidity", 0]]}]
    draft = {"name": "Sun and shade environmental comparison", "visibility": "private", "family": "multispeq",
             "description": "Record incident light, temperature and humidity in sun and shade. Use matched plants, "
             "record leaf age and time, alternate measurement order and keep device orientation consistent. "
             "Use this exploratory environmental recipe only after hardware validation; it does not measure photosynthesis.",
             "code": code}
    seen = []
    async def complete(model, payload):
        seen.append(copy.deepcopy(payload))
        step = len(seen)
        if step == 1:
            value = response(call("entry", skillId=skill_id, resource="SKILL.md"))
        elif step == 2:
            value = response(call("commands", skillId=skill_id, resource="references/command-semantics.md"),
                             call("analysis", skillId=skill_id, resource="references/analysis-and-integration.md"))
        elif step == 3:
            value = response(call("draft", "draft_entity", kind="protocol", value=draft))
        else:
            assert step == 4
            assert payload["max_tokens"] == 2000
            tool_messages = [json.loads(message["content"]) for message in payload["messages"] if message["role"] == "tool"]
            assert [message["content"] for message in tool_messages[:3]] == [
                library.read({"skillId": skill_id, "resource": resource})["content"]
                for resource in ["SKILL.md", "references/command-semantics.md", "references/analysis-and-integration.md"]]
            assert tool_messages[-1]["payload"] == draft
            value = answer()
            value["usage"] = {"prompt_tokens": 12000, "completion_tokens": 100}
            return value
        value["usage"] = {"prompt_tokens": [3500, 7720, 11164][step - 1], "completion_tokens": 196}
        return value
    monkeypatch.setattr(server, "complete_model", complete)
    body = request_body(rounds=4)
    body["messages"] = [{"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": "Help design a sun/shade bean comparison with MultispeQ."},
                        {"role": "assistant", "content": (
                            "Compare matched bean plants in sun and shade using environmental measurements. "
                            "Record plant identifier, treatment, leaf position, date, time, operator and device identifier. "
                            "Use biological replicates and keep repeated readings separate from independent plants. "
                            "Alternate measurement order between groups, hold device orientation consistent and record "
                            "recent watering and visible stress. Check temperature and humidity units against a real device "
                            "sample before analysis. Include incident light as context, not as a substitute for a fluorescence "
                            "measurement or a direct photosynthesis rate. The protocol draft will contain only supported "
                            "environmental commands; it must be reviewed and validated on hardware before collection. "
                            "A matching macro can compare descriptive statistics once representative raw input is available. "
                            "Do not silently discard missing readings or interpret a zero as missing. Mark exclusions with "
                            "a reason and retain the original data for review. Start with a short exploratory run, review "
                            "the payload shape and units, and then finalize the workbook questions and sampling plan. "
                            "No protocol, experiment or workbook has been created or executed yet. Confirmation is required. "
                            "Keep the first draft private and check any experiment embargo before assuming indefinite privacy. "
                            "The eventual report should state sample size, missing values, observation times and hardware "
                            "validation status. A sun/shade difference alone cannot establish a causal treatment effect "
                            "without randomization, comparable plants and control of other environmental differences. "
                            "For each collection session, document the growth conditions and how long plants have been "
                            "in the measurement area. Record whether the leaf was wet, visibly damaged or shaded by "
                            "the operator. Note weather changes during sampling, since a passing cloud can change "
                            "incident light between paired measurements. Keep the same measurement interval and "
                            "device positioning across treatments. Save an example raw measurement with the device "
                            "firmware version so that later analysis can be checked against the actual field names."
                        )},
                        {"role": "user", "content": "Draft a private MultispeQ protocol comparing sun and shade environments."}]
    body["tools"] = TOOLS
    body["limits"].update(maxTotalTokens=81488, maxOutputTokens=2000, maxToolCallsPerRound=8)
    first = client.post("/v1/agent/turns", json=body, headers=HEADERS)
    assert first.status_code == 200, first.text
    assert first.json()["usage"] == {"inputTokens": 22384, "outputTokens": 588}
    result = {"status": "pending_confirmation", "kind": "protocol", "payload": draft,
              "persistedFields": list(draft), "message": "A preview was prepared. Nothing has been created or executed."}
    continuation = {"protocolVersion": 1, "continuationToken": first.json()["continuationToken"],
                    "results": [{"id": "draft", "name": "draft_entity", "status": "completed", "result": result}]}
    from agent_runtime import estimate_prompt_tokens, resume_state
    continued_state = resume_state(continuation)
    assert continued_state["promptAccounting"]["inputTokens"] == 11164
    estimate = estimate_prompt_tokens(continued_state)
    assert 11164 < estimate < 16000
    del continued_state["promptAccounting"]
    assert estimate_prompt_tokens(continued_state) > 58516
    done = client.post("/v1/agent/turns/continue", headers=HEADERS, json=continuation)
    assert done.status_code == 200, done.text
    assert len(seen) == 4
    assert done.json()["usage"] == {"inputTokens": 34384, "outputTokens": 688}
