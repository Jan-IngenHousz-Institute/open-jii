"""Validate the dataset or run a live-model, synthetic-tool evaluation."""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from evaluation.contract import CONTRACT_SHA256, SYSTEM_PROMPT, TOOLS
from evaluation.dataset import DATASET_PATH, FIXTURE_KIND, load_dataset
from evaluation.tool_contract import tool_arguments_are_valid



class SyntheticScopedFixtureAdapter:
    """Return only the case-local synthetic result for a requested tool."""

    evidence_mode = "live_model_synthetic_scoped_tool_results"

    def __init__(self, fixture: dict[str, Any]):
        if fixture.get("kind") != FIXTURE_KIND:
            raise ValueError("Fixture is not explicitly labelled as synthetic scoped tool results")
        self._tools = fixture["tools"]

    def execute(self, request: dict[str, Any]) -> dict[str, Any]:
        call_id = request.get("id")
        name = request.get("name")
        arguments = request.get("arguments")
        base = {"id": call_id, "name": name}
        if not isinstance(call_id, str) or not isinstance(name, str) or not isinstance(arguments, dict):
            return {**base, "status": "failed", "error": "Malformed tool request"}
        if not tool_arguments_are_valid(name, arguments):
            return {
                **base,
                "status": "failed",
                "error": "Arguments do not match the approved tool schema",
            }
        definition = self._tools.get(name)
        if not isinstance(definition, dict):
            return {
                **base,
                "status": "failed",
                "error": "Tool unavailable or access denied by this synthetic case fixture",
            }
        constraints = definition["argumentsContain"]
        if any(arguments.get(key) != value for key, value in constraints.items()):
            return {
                **base,
                "status": "failed",
                "error": "Arguments are outside this synthetic case fixture's scope",
            }
        if definition["status"] == "failed":
            return {**base, "status": "failed", "error": definition["result"]}
        return {**base, "status": "completed", "result": definition["result"]}


def run_live_case(
    row: dict[str, Any],
    *,
    client: httpx.Client,
    agent_url: str,
    gateway_token: str,
    model: str,
) -> dict[str, Any]:
    started_at = time.perf_counter()
    adapter = SyntheticScopedFixtureAdapter(row["fixture"])
    start_body = {
        "protocolVersion": 1,
        "model": model,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, *row["inputs"]["messages"]],
        "tools": TOOLS,
        "limits": {
            "maxToolRounds": 4,
            "maxOutputTokens": 2_000,
            "maxToolCallsPerRound": 8,
            "maxTotalTokens": 100_000,
        },
    }
    headers = {"X-OpenJII-Gateway-Key": gateway_token}
    response = _post_json(client, f"{agent_url}/v1/agent/turns", start_body, headers)
    model_profile = response.get("modelProfile")
    tool_requests: list[dict[str, Any]] = []
    tool_results: list[dict[str, Any]] = []

    for _round in range(5):
        if response.get("modelProfile") != model_profile:
            raise RuntimeError("Agent model profile changed during the evaluated turn")
        status = response.get("status")
        if status == "completed":
            answer = response.get("content")
            if not isinstance(answer, str) or not answer.strip():
                raise RuntimeError("Agent returned a completed response without an answer")
            usage = response.get("usage")
            return {
                "toolRequests": tool_requests,
                "answer": answer.strip(),
                "toolResults": tool_results,
                "evidenceMode": adapter.evidence_mode,
                "model": model,
                "contractSha256": CONTRACT_SHA256,
                "modelProfile": model_profile,
                "usage": usage if isinstance(usage, dict) else {},
                "latencyMs": round((time.perf_counter() - started_at) * 1_000),
            }
        if status != "tool_requests":
            raise RuntimeError(f"Agent returned unsupported status {status!r}")
        requests = response.get("requests")
        continuation_token = response.get("continuationToken")
        if not isinstance(requests, list) or not isinstance(continuation_token, str):
            raise RuntimeError("Agent returned an invalid continuation response")
        normalized_requests = [_request_dict(request) for request in requests]
        results = [adapter.execute(request) for request in normalized_requests]
        tool_requests.extend(normalized_requests)
        tool_results.extend(results)
        response = _post_json(
            client,
            f"{agent_url}/v1/agent/turns/continue",
            {
                "protocolVersion": 1,
                "continuationToken": continuation_token,
                "results": results,
            },
            headers,
        )
    raise RuntimeError("Agent did not complete within the permitted tool rounds")


def build_answer_sheet(
    rows: list[dict[str, Any]],
    *,
    client: httpx.Client,
    agent_url: str,
    gateway_token: str,
    model: str,
) -> list[dict[str, Any]]:
    answer_sheet = []
    for row in rows:
        outputs = run_live_case(
            row,
            client=client,
            agent_url=agent_url,
            gateway_token=gateway_token,
            model=model,
        )
        answer_sheet.append(
            {
                "inputs": row["inputs"],
                "outputs": outputs,
                "expectations": row["expectations"],
            }
        )
    return answer_sheet


def run_evaluation(args: argparse.Namespace) -> None:
    _load_env_file(Path(__file__).parents[1] / ".env")
    rows = load_dataset(args.dataset)
    gateway_token = os.environ.get("ASSISTANT_GATEWAY_TOKEN")
    if not gateway_token:
        raise RuntimeError("ASSISTANT_GATEWAY_TOKEN is required for a live evaluation run")
    agent_url = (args.agent_url or os.environ.get("ASSISTANT_AGENT_URL") or "http://127.0.0.1:8030").rstrip("/")
    _validate_agent_url(agent_url)
    model = args.model or os.environ.get("ASSISTANT_EVAL_MODEL")
    if not model:
        raise RuntimeError(
            "ASSISTANT_EVAL_MODEL or --model is required; the evaluator does not choose a model implicitly"
        )

    with httpx.Client(timeout=httpx.Timeout(150, connect=15)) as client:
        answer_sheet = build_answer_sheet(
            rows,
            client=client,
            agent_url=agent_url,
            gateway_token=gateway_token,
            model=model,
        )

    if args.answer_sheet_out:
        args.answer_sheet_out.write_text(
            "\n".join(json.dumps(row, ensure_ascii=False) for row in answer_sheet) + "\n",
            encoding="utf-8",
        )

    result = evaluate_answer_sheet(
        answer_sheet,
        semantic_judges=args.semantic_judges,
        judge_model=args.judge_model,
    )
    run_id = getattr(result, "run_id", None)
    print(
        f"Evaluated {len(answer_sheet)} live-model cases with {SyntheticScopedFixtureAdapter.evidence_mode}."
    )
    if run_id:
        print(f"MLflow run: {run_id}")
    if not args.semantic_judges:
        print("Semantic judges were not enabled; only deterministic code scorers ran.")


def evaluate_answer_sheet(
    answer_sheet: list[dict[str, Any]],
    *,
    semantic_judges: bool,
    judge_model: str | None,
) -> Any:
    import mlflow

    from evaluation.scorers import DETERMINISTIC_SCORERS, semantic_scorers

    experiment_name = os.environ.get("MLFLOW_EXPERIMENT_NAME")
    if experiment_name:
        mlflow.set_experiment(experiment_name)
    selected_scorers = list(DETERMINISTIC_SCORERS)
    if semantic_judges:
        selected_judge_model = judge_model or os.environ.get(
            "ASSISTANT_EVAL_JUDGE_MODEL", "databricks:/databricks-gpt-5-mini"
        )
        selected_scorers.extend(semantic_scorers(selected_judge_model))

    return mlflow.genai.evaluate(data=answer_sheet, scorers=selected_scorers)


def score_preserved_answer_sheet(args: argparse.Namespace) -> None:
    _load_env_file(Path(__file__).parents[1] / ".env")
    answer_sheet = _load_answer_sheet(args.answer_sheet, allow_legacy_contract=args.allow_legacy_contract)
    if args.allow_legacy_contract:
        print("Historical scoring override enabled; results are not current-contract comparison evidence.")
    result = evaluate_answer_sheet(
        answer_sheet,
        semantic_judges=args.semantic_judges,
        judge_model=args.judge_model,
    )
    run_id = getattr(result, "run_id", None)
    print(f"Scored {len(answer_sheet)} preserved answer-sheet cases without assistant-model calls.")
    if run_id:
        print(f"MLflow run: {run_id}")
    if not args.semantic_judges:
        print("Semantic judges were not enabled; only deterministic code scorers ran.")


def _load_answer_sheet(path: Path, *, allow_legacy_contract: bool = False) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not raw_line.strip():
            continue
        try:
            row = json.loads(raw_line)
        except json.JSONDecodeError as error:
            raise ValueError(f"{path}:{line_number}: invalid JSON") from error
        if not isinstance(row, dict) or set(row) != {"inputs", "outputs", "expectations"}:
            raise ValueError(
                f"{path}:{line_number}: answer-sheet row requires inputs, outputs, and expectations"
            )
        outputs = row["outputs"]
        if (
            not isinstance(outputs, dict)
            or not isinstance(outputs.get("toolRequests"), list)
            or not isinstance(outputs.get("answer"), str)
            or outputs.get("evidenceMode")
            != SyntheticScopedFixtureAdapter.evidence_mode
        ):
            raise ValueError(f"{path}:{line_number}: invalid or unlabelled evaluation outputs")
        if not allow_legacy_contract and outputs.get("contractSha256") != CONTRACT_SHA256:
            raise ValueError("Answer sheet uses an unknown or stale contract. Use --allow-legacy-contract only for explicitly historical scoring.")
        rows.append(row)
    if not rows:
        raise ValueError(f"{path}: answer sheet is empty")
    return rows


def validate_command(dataset: Path) -> None:
    rows = load_dataset(dataset)
    scenarios = sorted({row["expectations"]["scenario"] for row in rows})
    print(f"Validated {len(rows)} cases across {len(scenarios)} scenarios: {', '.join(scenarios)}")
    print("No provider or MLflow tracking connection was used.")


def _post_json(
    client: httpx.Client,
    url: str,
    body: dict[str, Any],
    headers: dict[str, str],
) -> dict[str, Any]:
    response = client.post(url, json=body, headers=headers)
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as error:
        raise RuntimeError(f"Assistant agent request failed with HTTP {response.status_code}") from error
    try:
        value = response.json()
    except ValueError as error:
        raise RuntimeError("Assistant agent returned invalid JSON") from error
    if not isinstance(value, dict):
        raise RuntimeError("Assistant agent returned a non-object response")
    return value


def _request_dict(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise RuntimeError("Agent returned a malformed tool request")
    call_id = value.get("id")
    name = value.get("name")
    arguments = value.get("arguments")
    if not isinstance(call_id, str) or not isinstance(name, str) or not isinstance(arguments, dict):
        raise RuntimeError("Agent returned a malformed tool request")
    return {"id": call_id, "name": name, "arguments": arguments}


def _validate_agent_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.query or parsed.fragment:
        raise ValueError("Agent URL must be an http(s) origin without query or fragment")


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.removeprefix("export ").split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if key:
            os.environ.setdefault(key, value)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subcommands = parser.add_subparsers(dest="command", required=True)
    validate_parser = subcommands.add_parser("validate", help="Validate the dataset without providers")
    validate_parser.add_argument("--dataset", type=Path, default=DATASET_PATH)
    run_parser = subcommands.add_parser("run", help="Run the live model and evaluate its outputs")
    run_parser.add_argument("--dataset", type=Path, default=DATASET_PATH)
    run_parser.add_argument("--agent-url")
    run_parser.add_argument("--model")
    run_parser.add_argument("--answer-sheet-out", type=Path)
    run_parser.add_argument("--semantic-judges", action="store_true")
    run_parser.add_argument("--judge-model")
    score_parser = subcommands.add_parser(
        "score", help="Score a preserved answer sheet without calling the assistant model"
    )
    score_parser.add_argument("--answer-sheet", type=Path, required=True)
    score_parser.add_argument("--semantic-judges", action="store_true")
    score_parser.add_argument("--allow-legacy-contract", action="store_true", help="Score historical results without claiming current-contract comparability")
    score_parser.add_argument("--judge-model")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    if args.command == "validate":
        validate_command(args.dataset)
        return
    if args.command == "score":
        score_preserved_answer_sheet(args)
        return
    run_evaluation(args)


if __name__ == "__main__":
    main()
