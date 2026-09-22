# openJII Custom Agent

A Python FastAPI agent runs locally or on Databricks Apps and owns model calls, tool selection and bounded orchestration. The existing NestJS backend authenticates researchers, checks resource permissions, runs tools and handles write confirmation. This service receives messages and tool results, never browser session cookies. It returns tool requests to the authenticated backend through an encrypted, expiring continuation protocol. It does not grant platform permissions or execute platform writes.

## Run locally

Use Python 3.11 or later and uv. Refresh the development workspace login:

```sh
databricks auth login --profile dev --host https://dbc-6efd58ae-21b6.cloud.databricks.com
uv sync --project apps/assistant-agent
```

Copy `.env.example` to `.env` in this directory. Set a random `ASSISTANT_GATEWAY_TOKEN` there and in `apps/backend/.env`. Set `ASSISTANT_AGENT_URL=http://127.0.0.1:8030` and `ASSISTANT_DATABRICKS_MODEL` in the backend. Enable the same model in this service's `ASSISTANT_ALLOWED_MODELS`; the dev workspace must grant access to that endpoint.

```sh
uv run --project apps/assistant-agent --env-file apps/assistant-agent/.env \
  uvicorn app:app --app-dir apps/assistant-agent --host 127.0.0.1 --port 8030
```

`GET /health` reports process health. It does not prove Databricks authentication or model availability. `POST /v1/agent/turns` starts a turn and `/v1/agent/turns/continue` supplies tool results. Both require `X-OpenJII-Gateway-Key`. Python validates the exact requested tool IDs and names, caps rounds and returns cumulative token usage. Successful steps and failures after model calls include `usageComplete`. If it is false, the counts are only a lower bound and the backend must retain its quota reservation. Continuations expire ten minutes after the initial request and work across App replicas. Keep them server-side and out of logs.

The compatibility endpoint `POST /v1/chat/completions` requires `X-OpenJII-Gateway-Key`, forwards validated requests to the configured model, and passes through actual upstream streaming events. Provider errors are redacted. The gateway bounds request size, message count and output tokens. The backend separately enforces the researcher budget.

## Databricks Apps deployment

`app.yaml` starts the same service inside a Databricks App. Bind the `assistant-gateway-token` secret resource, grant the app service principal permission to query the chosen model endpoint, and give the openJII backend permission to access the app. The backend sends its app OAuth token in `Authorization` and the separate gateway credential in `X-OpenJII-Gateway-Key`. Do not set a personal CLI profile inside the hosted app; use its injected service-principal identity.

This PoC explicitly permits only the development workspace. Publishing code and creating an app does not by itself configure permissions or secrets. Record the deployment URL and a successful model call before describing it as deployed.

The service uses the structure of the [Databricks React and FastAPI example](https://www.databricks.com/blog/building-databricks-apps-react-and-mosaic-ai-agents-enterprise-chat-solutions). The frontend remains in the existing openJII application so its session and navigation continue to work.

## Verify

```sh
uv run --project apps/assistant-agent pytest apps/assistant-agent/tests -q
```

The tests cover authentication, endpoint restrictions, continuation integrity and expiry, result matching, round limits, cumulative token usage, streaming passthrough and error redaction. A local MLflow storage test checks nested spans and credential/content exclusion. They mock only the upstream network boundary; they do not establish access to a live Databricks endpoint.

## Tracing

The bundle creates `/Shared/openjii-assistant-poc`, grants the App `CAN_EDIT`, and supplies its experiment ID. Run both `databricks bundle deploy -t dev --profile dev` and `databricks bundle run -t dev --profile dev assistant_agent` to upload and start the App. A schema-valid bundle still requires live workspace validation.

For local tracing, set `ASSISTANT_TRACING_ENABLED=true`, `MLFLOW_TRACKING_URI` to a local SQLite URI or `databricks://dev`, and `MLFLOW_EXPERIMENT_NAME` or `MLFLOW_EXPERIMENT_ID`. Each continuation request records an AGENT span with a CHAT_MODEL child. A random turn ID groups the step traces as a session. These are separate request traces, not a single cross-service trace; tool execution timing in Nest is not instrumented by this Python code.

Content capture defaults off. Traces then contain message counts, tool names, model, latency, token usage and sanitized runtime failures. `ASSISTANT_TRACE_CONTENT=true` records prompts, scoped tool outputs and model responses for debugging and semantic evaluation. Use this for authored evaluation fixtures; review retention and access before enabling it for researcher data. Credentials, browser cookies and continuation tokens are never passed to span inputs or outputs. Metadata-only traces cannot support full answer-grounding judges.

Open the experiment's Traces tab to inspect steps. The local storage test proves instrumentation, not delivery to Databricks. See [tracing overview](https://docs.databricks.com/aws/en/mlflow3/genai/tracing/overview) and [manual tracing](https://docs.databricks.com/aws/en/mlflow3/genai/tracing/manual-tracing).

The custom continuation API preserves openJII authorization while the backend runs locally. It is not yet a ResponsesAgent API and does not establish AI Playground compatibility. The same FastAPI app is deployable on Apps; deployment and model access must be tested in the dev workspace.

## Turn budget

Protocol v1 requires `limits.maxTotalTokens`, a positive integer no greater than 100,000. The backend supplies its reserved allowance. Before every model step, Python subtracts cumulative measured usage and reduces `max_tokens` to fit the next input estimate. The first step reserves UTF-8 message/tool bytes plus framing allowances. Later steps reuse the provider-reported prompt count only when the exact prior messages, tools, model and profile match a stored hash; new messages receive the conservative byte/framing allowance. A mismatch restores the full-byte fallback. If no output allowance remains, it stops before requesting inference. It also stops when reported usage exceeds the reservation, or before a continuation whose previous usage was incomplete.

This is conservative preflight estimation plus measured postflight enforcement. It cannot guarantee exact provider billing without the provider's tokenizer or a count-tokens API. A provider overrun is reported with actual cumulative usage so accounting does not hide it. Incomplete usage remains a lower bound and retains the backend reservation.

## Current development model

The PoC uses `databricks-gpt-5-6-luna`, selected by the user on 21 September 2026. For this endpoint, Chat Completions function tools require `reasoning_effort: "none"`; the gateway applies that setting only to Luna tool requests. Other models still require explicit configuration.

## Adding and comparing a model

1. Verify that the endpoint is callable in the permitted development workspace. A Unity Catalog model listing alone is not serving access.
2. Add the endpoint to `ASSISTANT_ALLOWED_MODELS`. This is the access control; adding a compatibility profile does not enable a model.
3. If needed, add an entry to `model_profiles.json`. Supported settings are `toolReasoningEffort` and `maxOutputTokens`, capped at 8192. The runtime can reduce an output allowance but never raise the backend's allowance. Models without an entry use standard Chat Completions parameters. Restart the agent after changing profiles.
4. Set the backend's `ASSISTANT_DATABRICKS_MODEL` to the exact enabled endpoint and restart the backend. There is no automatic model fallback or per-user model selector in this spike.
5. Run provider-free checks, then the same versioned evaluation cases for each candidate with explicit `--model` and a distinct `--answer-sheet-out` file. Record the code revision and tool-contract revision with the run. Confirm tool calls, refusals, citations, draft content and failure accounting through the real authenticated UI before promotion.

Compare successful tasks, failure categories, input/output tokens and end-to-end latency. Keep historical runs when changing the default. Synthetic scoped-tool evaluation and live backend workflow evidence measure different things; report them separately. A changed fixture or tool contract starts a new comparison series.

Token quotas are not currency budgets. The spike does not maintain a verified endpoint price catalogue, calculate actual Databricks invoices, route traffic by quality, or automatically promote models. Before a shared pilot, add dated per-endpoint price units and usage reconciliation, project spending alerts and a kill switch, comparable regression runs, and an operator-controlled rollout/rollback record. Do not label an unknown price as zero.

## Runtime protocol-writing skill

The Databricks agent loads its skill catalogue from `skills/runtime-catalog.json`. The first
packaged skill, `multispeq-protocol-writing`, covers method selection, paired protocol/macro
baselines, pulse and detector ordering, firmware differences, analysis windows, and validation.
This is knowledge for the researcher-facing Python agent. It is not a coding-assistant skill.
The separate `skills/catalog.json` remains a candidate catalogue and is not loaded at runtime.

The turn API supplies a compact catalogue and an internal `read_skill(skillId, resource)` tool.
The model can read `SKILL.md`, then request the relevant reference files. Python resolves only
manifest-listed resources; it does not accept arbitrary paths or fetch websites. Local reads
consume the same tool-round and token allowance as other work. They do not reach Nest; mixed
rounds send only platform tool calls to the backend, where existing authorization still applies.
Skill instructions do not grant protocol execution, device access, or automatic confirmation.

The loader rejects symlinks and enforces 32 KiB per file, 128 KiB per package, 8 KiB for the
catalogue, and 64 KiB of cumulative reads per turn. A request uses an immutable content snapshot.
Its identity includes content, catalogue prompt, local tool schema, versioned read/provenance
protocol and read limits. That hash is bound to the encrypted continuation; a changed package requires a
new turn. Turn responses include `skillLibrary.hash` and read provenance (resource, SHA-256,
byte count and call ID). Evaluation answer sheets validate read IDs, allowlisted resources, content digests and byte counts
against the package. They retain that metadata and reject missing or
changed packages unless explicitly scoring historical evidence with `--allow-legacy-contract`.
Deploy the evaluator and agent from the same skill revision for comparable runs.

To update the skill, edit its Markdown references and allowlist, run the Python tests, then
review a representative protocol request. Schema acceptance is not proof of firmware support,
scientific validity or safe hardware operation. Provider-free tests can establish loading,
continuation integrity and tool routing; they cannot establish that a live model follows the
skill correctly. Deploying the package to a Databricks App remains a separate operation.

## Temporary local PoC token bypass

For explicitly authorized local testing, set both `ASSISTANT_RUNTIME_MODE=local` and
`ASSISTANT_POC_UNLIMITED_TOKENS=true` in the agent's untracked `.env`, then restart it.
This disables per-turn token preflight and cumulative-token rejection. It does not change
usage accounting, per-call output limits, tool-loop bounds, authentication or confirmation.
Hosted Databricks Apps reject this mode. Changing enforcement mode invalidates an existing
continuation; start a new turn. Defaults enforce the budget.

The backend daily allowance is separate. This local PoC was temporarily set to 10,000,000
tokens at the user's request; that is a generous daily ceiling, not unlimited billing. Restore
it to 100,000 and set `ASSISTANT_POC_UNLIMITED_TOKENS=false` before normal budget testing.
No deployed workspace setting was changed.
