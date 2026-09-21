"""MLflow spans deliberately exclude credentials and continuation tokens."""

import os
from contextlib import contextmanager
from functools import lru_cache
from typing import Any

import mlflow


@lru_cache(maxsize=1)
def configure_tracing() -> bool:
    if os.environ.get("ASSISTANT_TRACING_ENABLED", "false").lower() != "true":
        return False
    uri = os.environ.get("MLFLOW_TRACKING_URI", "databricks")
    mlflow.set_tracking_uri(uri)
    experiment_id = os.environ.get("MLFLOW_EXPERIMENT_ID")
    if experiment_id:
        mlflow.set_experiment(experiment_id=experiment_id)
    else:
        name = os.environ.get("MLFLOW_EXPERIMENT_NAME")
        if not name:
            raise RuntimeError("Tracing requires MLFLOW_EXPERIMENT_ID or MLFLOW_EXPERIMENT_NAME")
        mlflow.set_experiment(name)
    return True


def capture_content() -> bool:
    return os.environ.get("ASSISTANT_TRACE_CONTENT", "false").lower() == "true"


@contextmanager
def agent_span(state: dict[str, Any]):
    if not configure_tracing():
        yield None
        return
    with mlflow.start_span(name="openjii.agent.step", span_type="AGENT", attributes={
        "openjii.round": state["round"], "openjii.model": state["model"],
        "openjii.content_captured": capture_content(),
    }) as span:
        mlflow.update_current_trace(session_id=state["turnId"], tags={"environment": "dev", "agent": "openjii"})
        span.set_inputs({"messages": state["messages"]} if capture_content()
                        else {"messageCount": len(state["messages"]), "round": state["round"]})
        yield span


async def traced_completion(complete, model: str, payload: dict[str, Any]):
    if not configure_tracing():
        return await complete(model, payload)
    with mlflow.start_span(name="databricks.model", span_type="CHAT_MODEL",
                           attributes={"gen_ai.request.model": model}) as span:
        span.set_inputs(payload if capture_content() else {"messageCount": len(payload["messages"])})
        response = await complete(model, payload)
        usage = response.get("usage") or {}
        if isinstance(usage, dict):
            input_tokens, output_tokens = usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)
            if isinstance(input_tokens, int) and isinstance(output_tokens, int):
                span.set_attribute("mlflow.chat.tokenUsage", {"input_tokens": input_tokens,
                    "output_tokens": output_tokens, "total_tokens": input_tokens + output_tokens})
        span.set_outputs(response if capture_content() else {"usage": usage})
        return response


def record_agent_output(span, result: dict[str, Any]):
    if span is None:
        return
    output = {"status": result["status"], "usage": result["usage"],
              "tools": [r["name"] for r in result.get("requests", [])]}
    if capture_content():
        output.update({k: result[k] for k in ("content", "requests") if k in result})
    span.set_outputs(output)
