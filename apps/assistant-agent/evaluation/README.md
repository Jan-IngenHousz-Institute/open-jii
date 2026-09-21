# Assistant evaluation

This directory holds the curated offline dataset, deterministic scorers, and the runner for the Python continuation API. It does not enable production monitoring.

## Evidence boundary

The runner sends each case's user messages to the live `/v1/agent/turns` endpoint. When the model requests a tool, a case-local adapter returns an explicitly synthetic result and resumes the turn through `/v1/agent/turns/continue`.

This tests live model orchestration, tool selection, continuation handling, citations, and the final answer. It does **not** test Nest authorization, real document ownership, corpus admission, or live platform data. Those claims need a separate authenticated backend integration run. Evaluation outputs record `evidenceMode: live_model_synthetic_scoped_tool_results` so the two kinds of evidence cannot be confused.

Fixtures and expectations are never added to model messages. The model sees a synthetic fixture only after it requests that fixture's named tool, and then sees only the corresponding tool result.

## Dataset contract

Each line of `dataset.jsonl` contains:

| Field             | Purpose                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `id`              | Stable case slug.                                                                                                   |
| `inputs.messages` | User/assistant messages sent to the live agent after the production system prompt.                                  |
| `expectations`    | Scenario labels, required and forbidden tools, citations, refusal and draft boundaries, and forbidden answer terms. |
| `fixture.kind`    | Always `synthetic_scoped_tool_results`.                                                                             |
| `fixture.tools`   | Case-local tool results plus optional exact argument constraints.                                                   |

The dataset covers documentation and literature citations, a creator-scoped document fixture, denied access, draft-only writes, an unsupported live-data question, a malicious instruction embedded in retrieved content, a typed experiment-data query, and entity search. All content is authored synthetic data; there are no source credentials or private records.

The runner converts each completed case into an MLflow answer-sheet row:

```text
{
  inputs: {messages: [...]},
  outputs: {toolRequests: [...], answer: "...", toolResults: [...], evidenceMode: "...", model: "...", usage: {...}, latencyMs: 1234},
  expectations: {...}
}
```

`answer_citations` checks two independent facts: the expected source ID was supplied in a tool result, and the answer itself names the source (and page when required). A source appearing only in hidden tool evidence does not count as a citation.

## Commands

From the repository root, validate the dataset without a model, Databricks login, or MLflow tracking connection:

```bash
PYTHONPATH=apps/assistant-agent \
  apps/assistant-agent/.venv/bin/python -m evaluation.runner validate
```

Run the deterministic tests without provider credentials:

```bash
apps/assistant-agent/.venv/bin/pytest apps/assistant-agent/tests/test_evaluation.py
```

With the local agent already running, execute the live model and deterministic scorers:

```bash
PYTHONPATH=apps/assistant-agent \
  apps/assistant-agent/.venv/bin/python -m evaluation.runner run
```

The runner loads `apps/assistant-agent/.env` without printing it. It reads:

- `ASSISTANT_GATEWAY_TOKEN` for the local agent boundary;
- `ASSISTANT_AGENT_URL`, defaulting to `http://127.0.0.1:8030`;
- `ASSISTANT_EVAL_MODEL`, required unless `--model` is passed;
- `MLFLOW_TRACKING_URI` and optional `MLFLOW_EXPERIMENT_NAME` for the evaluation run.

Add `--answer-sheet-out <path>` to retain the synthetic answer sheet. It contains model answers and authored fixtures, but no gateway token.

Semantic judges are opt-in because they make additional model calls:

```bash
PYTHONPATH=apps/assistant-agent \
  apps/assistant-agent/.venv/bin/python -m evaluation.runner run \
  --semantic-judges \
  --judge-model databricks:/databricks-gpt-5-mini
```

The runner rejects non-Databricks judge URIs. One built-in `Guidelines` judge checks relevance and safety together with authorization, draft, grounding, and source-instruction boundaries. Keeping those criteria in one judge bounds a nine-row run to nine semantic assessments. No external provider key is used.

To judge a preserved answer sheet without rerunning the assistant model:

```bash
PYTHONPATH=apps/assistant-agent \
  apps/assistant-agent/.venv/bin/python -m evaluation.runner score \
  --answer-sheet apps/assistant-agent/evaluation/results/<candidate>.jsonl \
  --semantic-judges \
  --judge-model databricks:/databricks-gpt-5-mini
```

The evaluator never chooses an assistant model implicitly. The current user-selected development endpoint is `databricks-gpt-5-6-luna`. GLM/DeepSeek catalogue discovery did not establish callable serving access. Existing Qwen and GPT-OSS results are historical baselines, not accepted deployment evidence. Revalidate the production tool contract before comparing new runs with preserved answer sheets; earlier sheets predate the expanded authoring contract.

## Limits

- The live turn allows four tool rounds, eight calls per round, and 2,000 output tokens, matching the service caps.
- Tool results are static per case and do not establish backend authorization or data freshness.
- Deterministic refusal and unsupported-question checks use explicit phrases. The opt-in semantic judges assess meaning separately.
- `RetrievalGroundedness` is not used because answer-sheet traces do not contain real retriever spans. Grounding is covered by an opt-in Databricks `Guidelines` judge and the strict citation scorer.
- Nothing in this directory registers scorers for production monitoring.

## Keep the evaluation contract current

The runner imports `contract.json`, generated from the backend's `SYSTEM_PROMPT` and `TOOLS`. After changing authoring schemas or instructions, rebuild `@repo/api` and the backend, then run:

```bash
node apps/assistant-agent/evaluation/export-contract.mjs
node apps/assistant-agent/evaluation/export-contract.mjs --check
```

Commit the generated JSON with the source change. `--check` compares against the built backend, so run the builds first. New answer sheets record its SHA-256 alongside the model, latency and usage. Historical sheets without that field cannot establish performance on the current contract.

Synthetic tool validation uses those JSON schemas. It does not reproduce database permissions or all backend domain refinements. Browser confirmation tests remain necessary for real writes.

`pnpm assistant:check-contract` rebuilds backend dependencies and checks the export. The PR workflow runs this gate and the provider-free Python tests. Scoring rejects an answer sheet with a missing or different contract hash unless `--allow-legacy-contract` is explicitly passed; that override labels the run as historical scoring. New agent responses also carry the compatibility profile settings and hash. Answer sheets preserve that server-reported profile, leaving it null for older agents rather than guessing the remote configuration.
