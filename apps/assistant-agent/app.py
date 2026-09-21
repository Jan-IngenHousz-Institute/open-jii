"""Keep Databricks credentials behind the authenticated openJII backend."""

import hmac
import json
import os
import re
from functools import lru_cache
from typing import Any

import httpx
from databricks.sdk import WorkspaceClient
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.concurrency import run_in_threadpool
from model_profiles import apply_profile, profile_metadata

DEV_HOST = "https://dbc-6efd58ae-21b6.cloud.databricks.com"
MAX_BODY_BYTES = 2_000_000
app = FastAPI(title="openJII assistant agent", docs_url=None, redoc_url=None)


def require_backend(
    gateway_key: str | None = Header(default=None, alias="X-OpenJII-Gateway-Key"),
) -> None:
    expected = os.environ.get("ASSISTANT_GATEWAY_TOKEN", "")
    if not expected:
        raise HTTPException(503, "The backend gateway credential is not configured.")
    supplied = gateway_key or ""
    if not hmac.compare_digest(supplied.encode(), expected.encode()):
        raise HTTPException(401, "Backend authentication required.")


@lru_cache(maxsize=1)
def workspace() -> WorkspaceClient:
    host = os.environ.get("ASSISTANT_DATABRICKS_HOST", DEV_HOST).rstrip("/")
    if host != DEV_HOST:
        raise HTTPException(503, "This proof of concept only permits the dev workspace.")
    profile = os.environ.get("DATABRICKS_CONFIG_PROFILE")
    return WorkspaceClient(host=host, **({"profile": profile} if profile else {}))


def validate_payload(body: Any) -> tuple[str, dict[str, Any]]:
    if not isinstance(body, dict):
        raise HTTPException(422, "A chat request object is required.")
    model = body.get("model")
    allowed = {
        name.strip()
        for name in os.environ.get("ASSISTANT_ALLOWED_MODELS", "databricks-gpt-5-6-luna").split(",")
        if name.strip()
    }
    if not isinstance(model, str) or not re.fullmatch(r"[A-Za-z0-9_.-]+", model) or model not in allowed:
        raise HTTPException(422, "The requested model is not enabled for this gateway.")
    messages = body.get("messages")
    if not isinstance(messages, list) or not 1 <= len(messages) <= 100:
        raise HTTPException(422, "Provide between one and 100 messages.")
    if any(
        not isinstance(message, dict)
        or message.get("role") not in {"system", "developer", "user", "assistant", "tool"}
        for message in messages
    ):
        raise HTTPException(422, "A message has an invalid role.")
    stream = body.get("stream", False)
    if not isinstance(stream, bool):
        raise HTTPException(422, "stream must be a boolean.")
    payload = {key: value for key, value in body.items() if key != "model"}
    for key in ("max_tokens", "max_completion_tokens"):
        if key in payload:
            value = payload[key]
            if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 8192:
                raise HTTPException(422, "The output token limit must be between one and 8192.")
    if "max_tokens" not in payload and "max_completion_tokens" not in payload:
        payload["max_tokens"] = 2048
    return model, apply_profile(model, payload)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "openjii-assistant-agent", "workspace": "dev"}


@app.post("/v1/chat/completions", dependencies=[Depends(require_backend)])
async def chat(request: Request):
    chunks = bytearray()
    async for chunk in request.stream():
        chunks.extend(chunk)
        if len(chunks) > MAX_BODY_BYTES:
            raise HTTPException(413, "The chat request is too large.")
    try:
        body = json.loads(chunks)
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(422, "The request body must be JSON.") from None
    model, payload = validate_payload(body)
    try:
        client = await run_in_threadpool(workspace)
        headers = await run_in_threadpool(client.config.authenticate)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Databricks dev authentication is unavailable. Refresh the dev login.") from None

    transport = httpx.AsyncClient(timeout=httpx.Timeout(120, connect=15))
    try:
        upstream = await transport.send(
            transport.build_request(
                "POST",
                f"{DEV_HOST}/serving-endpoints/{model}/invocations",
                headers={**headers, "Content-Type": "application/json"},
                json=payload,
            ),
            stream=True,
        )
    except httpx.HTTPError:
        await transport.aclose()
        raise HTTPException(502, "Databricks could not be reached.") from None
    if upstream.status_code >= 400:
        status = upstream.status_code
        await upstream.aclose()
        await transport.aclose()
        raise HTTPException(503 if status in {401, 403, 429, 503} else 502,
                            f"Databricks rejected the request with status {status}.")

    if payload.get("stream"):
        async def events():
            try:
                async for chunk in upstream.aiter_bytes():
                    if await request.is_disconnected():
                        break
                    yield chunk
            finally:
                await upstream.aclose()
                await transport.aclose()
        return StreamingResponse(events(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})
    try:
        await upstream.aread()
        return JSONResponse(upstream.json(), headers={"Cache-Control": "no-store"})
    except (ValueError, httpx.HTTPError):
        raise HTTPException(502, "Databricks returned an invalid response.") from None
    finally:
        await upstream.aclose()
        await transport.aclose()


async def complete_model(model: str, payload: dict[str, Any]) -> dict[str, Any]:
    from agent_runtime import fail

    model, payload = validate_payload({"model": model, **payload})
    try:
        client = await run_in_threadpool(workspace)
        headers = await run_in_threadpool(client.config.authenticate)
    except Exception:
        fail("PROVIDER_UNAVAILABLE", "Databricks dev authentication is unavailable.", 503)
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120, connect=15)) as transport:
            response = await transport.post(f"{DEV_HOST}/serving-endpoints/{model}/invocations",
                                            headers=headers, json=payload)
            if response.status_code == 404:
                raise HTTPException(503, {
                    "code": "PROVIDER_MODEL_UNAVAILABLE",
                    "message": "The selected model has no callable endpoint in this Databricks workspace.",
                    "inferenceNotStarted": True,
                })
            response.raise_for_status()
            value = response.json()
            if not isinstance(value, dict):
                raise ValueError("invalid response")
            return value
    except (httpx.HTTPError, ValueError):
        fail("PROVIDER_UNAVAILABLE", "Databricks could not complete this turn.", 503)


async def read_agent_body(request: Request) -> Any:
    from agent_runtime import fail

    chunks = bytearray()
    async for chunk in request.stream():
        chunks.extend(chunk)
        if len(chunks) > MAX_BODY_BYTES:
            fail("INVALID_REQUEST", "The agent request is too large.", 413)
    try:
        return json.loads(chunks)
    except (ValueError, UnicodeDecodeError):
        fail("INVALID_REQUEST", "The request body must be JSON.")


@app.post("/v1/agent/turns", dependencies=[Depends(require_backend)])
async def start_turn(request: Request):
    from agent_runtime import advance, start_state

    state = start_state(await read_agent_body(request), validate_payload)
    state["modelProfile"] = profile_metadata(state["model"])
    result = await advance(state, complete_model)
    result["modelProfile"] = state["modelProfile"]
    return JSONResponse(result, headers={"Cache-Control": "no-store"})


@app.post("/v1/agent/turns/continue", dependencies=[Depends(require_backend)])
async def continue_turn(request: Request):
    from agent_runtime import advance, resume_state

    state = resume_state(await read_agent_body(request))
    if state.get("modelProfile") != profile_metadata(state["model"]):
        raise HTTPException(409, {
            "code": "INVALID_CONTINUATION",
            "message": "The model profile changed. Start a new turn.",
            "usage": state["usage"],
            "usageComplete": state.get("usageComplete", False),
        })
    result = await advance(state, complete_model)
    result["modelProfile"] = state["modelProfile"]
    return JSONResponse(result, headers={"Cache-Control": "no-store"})
