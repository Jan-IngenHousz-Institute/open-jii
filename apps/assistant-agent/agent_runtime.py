"""Resumable orchestration; platform tools execute at openJII's authorization boundary."""

import base64
import hashlib
import json
import os
import time
import uuid
from typing import Any, Awaitable, Callable, NoReturn

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

MAX_STATE_BYTES = 1_400_000
TURN_TTL = 600
TOOL_NAMES = {"search_entities", "get_entity", "search_knowledge", "query_experiment_data", "draft_entity"}
Completion = Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]]


def fail(code: str, message: str, status: int = 422) -> NoReturn:
    raise HTTPException(status, {"code": code, "message": message})


def cipher() -> Fernet:
    secret = os.environ.get("ASSISTANT_GATEWAY_TOKEN", "")
    if not secret:
        fail("PROVIDER_UNAVAILABLE", "The backend credential is not configured.", 503)
    key = hashlib.sha256(b"openjii-agent-continuation-v1\0" + secret.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def bounded_integer(value: Any, maximum: int) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 1 <= value <= maximum


def start_state(body: Any, validate_payload: Callable) -> dict[str, Any]:
    if not isinstance(body, dict) or body.get("protocolVersion") != 1:
        fail("INVALID_REQUEST", "Agent protocol version 1 is required.")
    model, validated = validate_payload({"model": body.get("model"), "messages": body.get("messages")})
    messages = validated["messages"]
    if any(m.get("role") not in {"system", "user", "assistant"}
           or not isinstance(m.get("content"), str) or set(m) - {"role", "content"}
           for m in messages):
        fail("INVALID_REQUEST", "Initial messages must contain only a role and text content.")
    tools = body.get("tools")
    if not isinstance(tools, list) or not 1 <= len(tools) <= len(TOOL_NAMES):
        fail("INVALID_REQUEST", "Provide the approved platform tool definitions.")
    names = []
    for tool in tools:
        if not isinstance(tool, dict) or tool.get("type") != "function":
            fail("INVALID_REQUEST", "Invalid tool definition.")
        function = tool.get("function")
        if not isinstance(function, dict) or not isinstance(function.get("name"), str) or function.get("name") not in TOOL_NAMES:
            fail("INVALID_REQUEST", "Unknown platform tool.")
        if not isinstance(function.get("parameters"), dict):
            fail("INVALID_REQUEST", "A tool parameter schema is required.")
        names.append(function["name"])
    if len(set(names)) != len(names):
        fail("INVALID_REQUEST", "Tool definitions must be unique.")
    limits = body.get("limits")
    caps = {"maxToolRounds": 4, "maxOutputTokens": 8192, "maxToolCallsPerRound": 8, "maxTotalTokens": 100_000}
    if not isinstance(limits, dict) or any(not bounded_integer(limits.get(k), cap) for k, cap in caps.items()):
        fail("INVALID_REQUEST", "Agent limits exceed the permitted bounds.")
    return {"version": 1, "turnId": str(uuid.uuid4()), "model": model, "messages": messages, "tools": tools,
            "limits": limits, "round": 0, "expiresAt": int(time.time()) + TURN_TTL,
            "usage": {"inputTokens": 0, "outputTokens": 0}, "usageComplete": True, "usedCallIds": []}


def resume_state(body: Any) -> dict[str, Any]:
    if not isinstance(body, dict) or body.get("protocolVersion") != 1:
        fail("INVALID_REQUEST", "Agent protocol version 1 is required.")
    token = body.get("continuationToken")
    if not isinstance(token, str) or len(token) > 1_900_000:
        fail("INVALID_CONTINUATION", "A valid continuation is required.")
    try:
        state = json.loads(cipher().decrypt(token.encode(), ttl=TURN_TTL))
        if (state["version"] != 1 or state["expiresAt"] <= time.time()
                or not bounded_integer(state["limits"].get("maxTotalTokens"), 100_000)):
            raise ValueError("expired")
    except (InvalidToken, ValueError, KeyError, TypeError, UnicodeError):
        fail("INVALID_CONTINUATION", "The continuation is invalid or expired.")
    results = body.get("results")
    expected = state["pending"]
    if not isinstance(results, list) or len(results) != len(expected):
        fail("INVALID_TOOL_RESULT", "Return exactly one result for each requested tool.")
    by_id = {}
    for result in results:
        if not isinstance(result, dict) or not isinstance(result.get("id"), str) or result["id"] in by_id:
            fail("INVALID_TOOL_RESULT", "Tool result identifiers must be unique.")
        by_id[result["id"]] = result
    for call in expected:
        result = by_id.get(call["id"])
        if not result or result.get("name") != call["name"] or result.get("status") not in {"completed", "failed"}:
            fail("INVALID_TOOL_RESULT", "A tool result does not match the pending request.")
        if result["status"] == "completed" and "result" not in result:
            fail("INVALID_TOOL_RESULT", "A completed tool must provide a result.")
        content = result["result"] if result["status"] == "completed" else {"error": "Tool unavailable or access denied."}
        state["messages"].append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(content)})
    del state["pending"]
    return state


async def advance(state: dict[str, Any], complete: Completion) -> dict[str, Any]:
    from tracing import agent_span, record_agent_output, traced_completion

    with agent_span(state) as span:
        async def traced(model, payload):
            return await traced_completion(complete, model, payload)
        try:
            result = await _advance(state, traced)
        except HTTPException as error:
            detail = error.detail if isinstance(error.detail, dict) else {
                "code": "PROVIDER_UNAVAILABLE", "message": "The agent could not complete this turn."}
            raise HTTPException(error.status_code, {**detail, "usage": dict(state["usage"]),
                                "usageComplete": state.get("usageComplete", False)}) from None
        record_agent_output(span, result)
        return result


async def _advance(state: dict[str, Any], complete: Completion) -> dict[str, Any]:
    if len(json.dumps(state).encode()) > MAX_STATE_BYTES:
        fail("TOOL_LOOP_LIMIT", "This turn exceeds the context size limit.")
    if not state.get("usageComplete", False):
        fail("TOOL_LOOP_LIMIT", "Cannot continue without complete token accounting.")
    remaining = state["limits"]["maxTotalTokens"] - sum(state["usage"].values())
    # Provider framing/tokenization is unavailable locally; reserve a conservative estimate.
    prompt_estimate = len(json.dumps({"messages": state["messages"], "tools": state["tools"]},
                                     ensure_ascii=False).encode())
    prompt_estimate += 1024 + 64 * len(state["messages"]) + 256 * len(state["tools"])
    output_allowance = min(state["limits"]["maxOutputTokens"], remaining - prompt_estimate)
    if output_allowance < 1:
        fail("TOOL_LOOP_LIMIT", "This turn has insufficient budget for another model step.")
    previous_usage_complete = state.get("usageComplete", False)
    state["usageComplete"] = False
    try:
        response = await complete(state["model"], {
            "messages": state["messages"], "tools": state["tools"], "tool_choice": "auto",
            "temperature": 0.2, "max_tokens": output_allowance,
        })
    except HTTPException as error:
        if isinstance(error.detail, dict) and error.detail.get("inferenceNotStarted") is True:
            state["usageComplete"] = previous_usage_complete
        raise
    usage = response.get("usage") if isinstance(response, dict) else None
    if isinstance(usage, dict):
        values = [usage.get("prompt_tokens"), usage.get("completion_tokens")]
        if all(isinstance(v, int) and not isinstance(v, bool) and v >= 0 for v in values):
            state["usage"]["inputTokens"] += values[0]
            state["usage"]["outputTokens"] += values[1]
            state["usageComplete"] = previous_usage_complete
        else:
            fail("PROVIDER_INVALID_RESPONSE", "The model returned invalid token accounting.", 502)
    if sum(state["usage"].values()) > state["limits"]["maxTotalTokens"]:
        fail("TOOL_LOOP_LIMIT", "The provider reported usage above this turn's budget.")
    try:
        message = response["choices"][0]["message"]
        if not isinstance(message, dict) or message.get("role") != "assistant":
            raise ValueError("invalid message")
        content = message.get("content")
        if isinstance(content, list):
            message = {**message, "content": "".join(
                block["text"] for block in content
                if isinstance(block, dict) and block.get("type") == "text"
                and isinstance(block.get("text"), str)
            )}
        calls = message.get("tool_calls") or []
        if not isinstance(calls, list):
            raise ValueError("invalid calls")
    except (KeyError, IndexError, TypeError, ValueError):
        fail("PROVIDER_INVALID_RESPONSE", "The model returned an invalid assistant response.", 502)
    if not calls:
        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            fail("PROVIDER_INVALID_RESPONSE", "The model returned no answer.", 502)
        if response["choices"][0].get("finish_reason") == "length":
            fail("TOOL_LOOP_LIMIT", "The model reached its output limit before finishing.")
        return {"status": "completed", "content": content.strip(), "usage": state["usage"], "usageComplete": state["usageComplete"], "stopReason": "stop"}
    if state["round"] >= state["limits"]["maxToolRounds"] or len(calls) > state["limits"]["maxToolCallsPerRound"]:
        fail("TOOL_LOOP_LIMIT", "The agent reached its tool-call limit.")
    names = {tool["function"]["name"] for tool in state["tools"]}
    pending = []
    normalized = []
    for call in calls:
        try:
            call_id, function = call["id"], call["function"]
            name, arguments = function["name"], function["arguments"]
            if not isinstance(call_id, str) or not 1 <= len(call_id) <= 200 or call_id in state["usedCallIds"]:
                raise ValueError("invalid id")
            if not isinstance(name, str) or name not in names or call.get("type") != "function" or not isinstance(arguments, str):
                raise ValueError("invalid function")
            parsed = json.loads(arguments)
            if not isinstance(parsed, dict):
                raise ValueError("invalid arguments")
        except (KeyError, TypeError, ValueError):
            fail("PROVIDER_INVALID_RESPONSE", "The model returned an invalid tool request.", 502)
        pending.append({"id": call_id, "name": name, "arguments": parsed})
        normalized.append({"id": call_id, "type": "function", "function": {"name": name, "arguments": arguments}})
        state["usedCallIds"].append(call_id)
    state["messages"].append({"role": "assistant", "content": message.get("content"), "tool_calls": normalized})
    state["round"] += 1
    state["pending"] = pending
    raw = json.dumps(state).encode()
    if len(raw) > MAX_STATE_BYTES:
        fail("TOOL_LOOP_LIMIT", "This turn exceeds the context size limit.")
    return {"status": "tool_requests", "requests": pending, "usage": state["usage"], "usageComplete": state["usageComplete"],
            "continuationToken": cipher().encrypt(raw).decode()}
