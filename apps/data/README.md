# OpenJII Data

Databricks notebooks, pipelines, and Python packages for openJII data ingestion and analysis.

## Layout

```text
src/
├── lib/                         # Internal Python packages (uv workspace members; deployed as wheels)
│   ├── ambyte/                  # Ambyte trace file parsing + volume I/O
│   ├── enrich/                  # Backend API client, user / annotation / macro / metadata enrichment
│   ├── openjii/                 # Catalog-aware helpers, decompression, table loaders
│   └── data_repair/             # @inline_repair decorator framework for known-corruption patches
├── pipelines/                   # Databricks DLT pipeline definitions
├── tasks/                       # Databricks workflow tasks (notebook-style scripts)
└── notebooks/                   # User-facing notebooks (e.g. data_hackathon_2026)

tests/lib/                       # pytest suites for the four libs
databricks.yml                   # Asset Bundle config (artifacts + notebook sync)
pyproject.toml                   # uv workspace root, ruff / pyright / pytest config
```

## Prerequisites

- **uv**: Python toolchain. Install with `brew install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`.
- **Databricks CLI**: for `databricks bundle …` commands.
- **Java 11+**: required by the local PySpark used in tests.

## Setup

```bash
# Sync the project venv (.venv) and install all four lib workspace members
# in editable mode plus dev dependencies (pytest, chispa, ruff, pyright, …).
uv sync
```

The Python version is pinned via `.python-version` (3.11). uv will install it automatically if missing.

## Common tasks

All scripts go through `pnpm` so they integrate with the monorepo's turbo pipeline; each one wraps a `uv run …` invocation.

```bash
pnpm test              # pytest
pnpm test:cov          # pytest + coverage
pnpm lint              # ruff check
pnpm format            # ruff format
pnpm typecheck         # pyright
pnpm build             # uv build --all-packages → dist/*.whl per lib
pnpm validate:dev      # databricks bundle validate -t dev
pnpm validate:prod     # databricks bundle validate -t prod
```

You can run the underlying tools directly too:

```bash
uv run pytest -m "not spark"        # skip Spark-fixture tests for fast feedback
uv run pytest tests/lib/test_compression.py -v
uv run ruff check --fix .
uv build --all-packages
```

## Tests

The test suite covers the pure-logic surface of each library: compression, HMAC signing, batching and chunked-error paths in the backend client, question-label sanitization and Spark-side column expansion, the repair-manifest registry (severity + predicate filtering), the RIDES re-interleave algorithm, and the upload-directory parser.

Tests that require a SparkSession are scoped to a single session-level fixture in `tests/conftest.py` and gated behind the `spark` marker. There is also a `fake_dlt` fixture that injects a stub `dlt` module so DLT pipeline files can be imported in tests without crashing.

## Catalog configuration

`openjii.get_catalog_name()` resolves at call time from:

1. `spark.conf` key `CATALOG_NAME` (set by DLT pipelines, cluster Spark config, or terraform).
2. Environment variable `OPENJII_CATALOG`.

Earlier versions injected this into `_config.py` at wheel-build time (one wheel per environment); the runtime resolution lets a single artifact serve all environments.

## AMBIT payload v3 (`openjii.trace`)

`openjii/trace/` implements the persisted-event contract the Ambyte publishes (`docs/mqtt-payload.md` in the ambyte-iot repo): `ambit.trace/3`, `ambyte.telemetry/1`, and `ambit.device/1`, plus the v2 dual-read rules that keep history queryable.

Because time and units travel inside the payload, one generic function turns any self-describing measurement into a timeseries - no protocol join, no per-device decoder:

```sql
SELECT p.* FROM open_jii_dev.centrum.enriched_experiment_raw_data r,
LATERAL open_jii_dev.centrum.trace_points(r.data) p
WHERE r.experiment_id = :exp;

-- v2 and v3 rows together, already normalized:
SELECT t.source_row_id, p.* FROM open_jii_dev.centrum.experiment_ambit_trace t,
LATERAL open_jii_dev.centrum.trace_points(t.trace) p;
```

The Unity Catalog objects (DDL in `openjii/trace/sql/`, registered by `src/tasks/centrum_v3_sql_objects_task.py`):

| object                                          | purpose                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| `trace_points(m VARIANT)`                       | table function: `series, t, value, unit`, exploded at query time         |
| `measurement_object(v VARIANT)`                 | unwraps the firmware's one-element `sample` array                        |
| `ambit_trace_v3(v, event_time)`                 | v2 -> v3 trace normalizer; NULL for non-traces                           |
| `ambyte_telemetry_v1(v, event_time, device_id)` | v2 STATUS / `device.bme280` / v3 heartbeat -> one telemetry object       |
| `ambit_device_v1(v, event_time)`                | v2 DEVICE_INFO / v3 inventory -> one inventory object                    |
| `cal_version_hex8(s)`                           | canonical eight-lowercase-hex-digit calibration CRC                      |
| `experiment_ambit_trace`                        | every trace, v2 and v3, in one shape                                     |
| `experiment_ambyte_telemetry`                   | one canonical telemetry row per source event                             |
| `experiment_environment_observations`           | gateway BME280 projection of that row                                    |
| `experiment_device_health`                      | health projection of the same row, same identity                         |
| `experiment_attached_sensors`                   | inventory keyed by the `(sensor_id, firmware, cal_version)` change tuple |
| `experiment_attached_sensors_latest`            | the latest tuple per sensor                                              |

These are views and functions, not tables: materializing pulse grain for every experiment is what the Grebbedijk precedent (27 M rows for 3 days) warns against. Wrap `trace_points` in a small gold table per experiment when a dashboard needs the grain hot.

`openjii.trace.to_timeseries(payload)` is the notebook-side transcription of the same rule, and accepts v2 or v3 payloads. It and the SQL are held to the same numbers deliberately:

- One rounding rule in both, half away from zero: `sign(x) · floor(|x| · 10^d + 0.5) / 10^d`. It does **not** simplify to `floor(x·10^d + 0.5)/10^d` — that form is half-up only for non-negative x and turns `-24.605` into `-24.60` instead of `-24.61`, so sub-zero leaf and air temperatures would be silently wrong. Spark's `round` is decimal half-up and Python's is ties-to-even, and they disagree at `0.14945` (a freq-40 timeline at index 7), so neither is used. Python: `openjii.trace.round_to`; SQL: `round_half_up` / `round_half_up_array`.
- An explicit `t` array is authoritative for every sample. A short, null or non-numeric element yields a NULL timestamp on both sides rather than being refilled from `(t0, dt)`, which would invent a time the payload never stated.
- v2 subsampled ambient means are dated by the window centre on _their own_ segment's clock. Where that reconstruction cannot account for the values received, the series is emitted with no time model and `_compat.ambient_time_unresolved` records why.
- Unnamed FSM indices (`arr9`..`arr15`) survive normalization as `count` series on the main clock instead of being dropped. `arr8` is not one of them: it is consumed as `leaf_temp`'s device-recorded offsets.
- Both historical spellings of the 630 nm channels normalize to the same series. FSM indices 1 and 2 were tagged `s_fluo`/`r_fluo` before the firmware renamed them to `s_630`/`r_630`, and SD-card backlogs still carry the old names, so a consumer would otherwise have to branch on the vintage. Precedence is deterministic — the canonical `s_630`/`r_630` wins, exactly one series per channel is emitted either way, and `_compat.legacy_fluo_alias` records when the legacy tags supplied the values. This is unrelated to the derived `fluo` ratio array, which is still not carried over.

The v2 path is permanent. A v3-capable Ambyte deliberately falls back to a v2 row when identity or calibration is unavailable, so both generations arrive interleaved indefinitely; one input row always yields exactly one canonical object.

Deploy and verify:

```bash
databricks bundle deploy -t dev --profile <profile>
# Waits and streams the result, so it needs no run id of its own. The rollout
# workflow cannot use this form: it has to record *which* run proved the release.
databricks bundle run centrum_v3_sql_objects -t dev --profile <profile>
```

The job registers the objects and then runs `src/tasks/centrum_v3_smoke_task.py`, which replays the fixtures in `openjii/trace/fixtures/` through the real DDL and fails on any contract mismatch. VARIANT and SQL UDFs do not exist in local PySpark, so the local suite pins the Python reference against the same fixtures and this job pins the SQL.

Two things about that job are load-bearing rather than incidental, and `tests/lib/test_bundle_governance.py` fails the build if either regresses:

- **It runs as the node service principal**, resolved by display name at deploy time. That is the identity Terraform grants `CREATE_FUNCTION` / `CREATE_SCHEMA` / `CREATE_TABLE` / `SELECT` on the catalog; the CI principal that runs `bundle deploy` has none of those and would otherwise be the default Run as identity. `users` get `CAN_VIEW`, never `CAN_MANAGE` — that would let any workspace user edit a job that runs DDL.

  Assigning that `run_as` is itself a permission: the deployer must hold the Service Principal User role on the principal it names. Workspace membership is not that role and Service Principal Manager does not inherit it, so `infrastructure/env/{dev,prod}/main.tf` grants it explicitly with a `databricks_access_control_rule_set` (`roles/servicePrincipal.user`, CI principal → node principal, one role and nothing else). Note that a rule set is authoritative for the principal it names, so applying it replaces any equivalent grant made by hand in the account console.

  `bundle validate` cannot prove that role. `scripts/preflight_dab_run_as.py` can, and both the deploy workflow and the two-phase rollout run it as the CI identity immediately before `bundle deploy`: it resolves the identity, asserts the resolved job governance (run identity, no group `CAN_MANAGE`, wheel version, no schema input), and then creates and deletes a disposable paused job carrying only `run_as`. That probe is the only step that actually exercises the role, and it fails before anything real is mutated.

  The wheel-version assertion is fail-closed and does not depend on the package being installed: the expected version comes from the committed `src/lib/openjii/pyproject.toml`, or from an explicit `--wheel-version`. If neither can be determined the preflight errors rather than skipping the check.

  ```bash
  # locally, authenticated exactly as CI:
  python scripts/preflight_dab_run_as.py --target dev --prove-run-as
  ```

- **The smoke test's scratch schema is generated, not configured.** `openjii.trace.scratch` mints a `zz_v3_smoke_<random>` name, validates it before creating it and again before dropping it, and cleanup runs in `finally`. There is no schema parameter, so nothing — a mistyped override, an edited job — can point the one `DROP SCHEMA ... CASCADE` at a schema holding data. The registration task that touches the real `centrum` schema contains no `DROP` at all.

### Rolling out an `openjii` wheel version bump

The wheel version in the job's serverless dependency must track `src/lib/openjii/pyproject.toml`: serverless caches an environment per package version, so shipping changed code under an unchanged version can keep serving the old implementation. Bumping it also means updating the four `openjii-<version>` references in `infrastructure/env/{dev,prod}/main.tf`, because the centrum cluster policy and the data-export job name the wheel by filename.

Those two facts make the ordinary release workflow the wrong tool. `deploy.yml` applies the whole Terraform root _before_ it deploys the bundle, which would point live resources at a wheel that has not been uploaded yet. The same commit also introduces the run-as ACL, and the bundle cannot create its `run_as` job until that ACL exists — but a full apply to install the ACL would move the wheel references too. That circle is what the two-phase workflow breaks.

**Use [.github/workflows/data-wheel-rollout.yml](../../.github/workflows/data-wheel-rollout.yml)** (Actions → "Data wheel rollout"), one environment at a time.

> **First activation is post-merge.** GitHub only registers `workflow_dispatch` for workflow files that exist on the **default branch**, so a brand-new rollout workflow cannot be dispatched from a feature branch — not from the Actions UI and not with `gh workflow run --ref <branch>`. For the first release that means:
>
> 1. Pre-merge evidence is the offline static/unit matrix only (`uv run pytest`, workflow parsing, the mocked plan/guard/attestation checks, action-input and required-variable comparison, CLI help, lint, types, build). Nothing mutating, and **no** `push`/`pull_request`/`repository_dispatch` trigger added to demonstrate it.
> 2. Merge the reviewed workflow so GitHub registers it.
> 3. **Do not approve the ordinary deployment** that the merge triggers for this wheel transition — reject or cancel it. Its Guard Data Wheel Transition job is designed to fail here, which is the signal to come to this workflow instead.
> 4. Dispatch this workflow against the exact merged SHA, dev first.

It runs, with an approval after each plan is produced and before it is applied:

| phase | what it does                                                                                                                                                                                                  | why it is separate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | resolves the wheel version and Terraform config digest; for prod, reads the dev run's own Actions record and validates dev's attestation against it                                                           | a prod rollout must prove _this_ release reached dev, and the artifact alone cannot prove which run made it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 1     | reads the node service principal's rule set and etag, **read-only**                                                                                                                                           | the Terraform resource is authoritative, so any grant it does not declare would be dropped. There is no acknowledgement flag: an uncodified grant fails the phase, and the fix is to add it to the resource                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2     | `tofu plan -target=…node_service_principal_run_as` → `tofu show -json` → address/action gate → upload                                                                                                         | installs the ACL **without** moving a wheel reference. The gate reads the plan JSON: a `-target` plan may include the target's dependencies, and none of those contain a wheel filename, so grepping text proves nothing                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3     | approval                                                                                                                                                                                                      | reviews the artifact phase 2 produced, which is why it comes after it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 4     | fresh live GET of the rule set, etag compared to the reviewed one; then re-verify the binding and the JSON and `tofu apply <that saved plan>`                                                                 | a human sat between the plan and the apply. An ACL changed in that window would be silently overwritten, so it aborts instead                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 5     | derive the outgoing wheel from **both** live refs → back it up and upload the backup → `bundle validate` + machine-readable `bundle plan` → bind                                                              | the outgoing filename is read from live, not typed in, and the bundle plan is evidence that gets approved rather than console output nobody compares                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6     | approval                                                                                                                                                                                                      | the bundle deploy mutates the workspace, so its plan is reviewed like a Terraform plan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 7     | re-verify the bundle plan binding → run-as probe → `bundle deploy` → dual-wheel proof → **always** re-list, restore if pruned, prove                                                                          | retention can prune the outgoing wheel on a _successful_ deploy too, and live references still name it for three more phases                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 8     | full `tofu plan` → `tofu show -json` → gate → upload                                                                                                                                                          | delete and replace are refused unconditionally; only the cluster policy, the Data Export job and the already-applied ACL may change, both wheel references must actually move, and there is no input that widens that                                                                                                                                                                                                                                                                                                                                                                                                    |
| 9     | approval                                                                                                                                                                                                      | same reason as phase 3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 10    | apply the approved plan, then read **both** live refs back                                                                                                                                                    | the cluster policy _and_ the Data Export job must name exactly the uploaded wheel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 11    | pipeline update with an explicit `{"full_refresh": false}` body, polled to a terminal state                                                                                                                   | there is no `--no-full-refresh` flag on any pinned CLI, and "started" is not "succeeded"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 12    | resolves the deployed smoke job id from `bundle summary --output json`, starts it with `jobs run-now <JOB_ID> --no-wait --output json`, polls that exact run id until it is coherently `TERMINATED`/`SUCCESS` | the SQL/replay smoke. `bundle run --no-wait` is not used: on the pinned CLI its no-wait branch returns no run output, so it prints a URL and marshals nothing. The real Databricks run id and result state are captured or the phase fails: nothing defaults to SUCCESS or substitutes the Actions run id. Success is the _pair_, not either half -- `SKIPPED` (another run was already active) and `INTERNAL_ERROR` (a Jobs service failure) are failures even when a success-looking result accompanies them, and a response whose legacy `state` and current `status` shapes disagree is refused rather than combined |
| 13    | dev only: publish the immutable attestation                                                                                                                                                                   | the artifact prod validates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

> **Do not hard-cancel phase 7.** Cancelling a run skips remaining steps, cleanup included, so a cancel between the deploy and the retention proof can leave the outgoing wheel pruned while the live references still name it. Let the phase fail on its own — its cleanup runs on `always()` and restores the wheel. If it was cancelled anyway, download the `outgoing-wheel-…` artifact and re-import it before touching Terraform.

Nothing in this workflow takes a resource address, a regex, a previous wheel filename or an acknowledgement from the operator: the two dispatch inputs are the target environment and, for prod, the dev run id. The approved addresses and actions live in `scripts/check_tofu_plan.py` as exact strings, selected by phase (`--allow-set acl` / `--allow-set full`), so widening them is a reviewed code change. Dispatch inputs and job outputs reach shell scripts through `env:` and are referenced quoted, never spliced into the script text.

Every plan is saved, shown, gated on its JSON, and bound to its environment, commit, run id, run attempt, Terraform config digest and the ACL inventory etag. The apply re-verifies all of that before consuming the artifact, so a plan from another environment, commit, run or retry — or a plan file altered after approval — cannot be applied.

Production requires `dev_run_id`, and it checks two independent sources against each other. The **attestation artifact** carries target, SHA, run/attempt, both wheels, both plan digests, both live-reference readbacks, the update id/state with `full_refresh:false`, and the real smoke run id and state; every field is required and every field has to have the shape it claims, so a partial or hand-written record fails. The **Actions run record** (`gh api …/actions/runs/<id>`) then has to agree: the run must be this workflow file, dispatched, successful, on this commit, on the attempt the attestation names, and it must be the run that produced the artifact. `gh run view --json` cannot report workflow inputs or which workflow file a run is, which is why the API record and not the run's own claim is what gets read. Each environment also has its own artifact directory, so a dev upload never satisfies a production reference.

`deploy.yml` refuses this class of change rather than letting it through in the wrong order. Its **Guard Data Wheel Transition** job compares the wheel version _this commit builds_ against the wheel the two live resources actually reference, and fails with a pointer here when they differ. That is transition detection, not path detection: it needs no diff against a previous commit, so manual releases are covered; it clears itself once the rollout has run; and it catches a hand-edited reference to a version nobody built.

It runs whenever an infrastructure apply **or** a Databricks deploy could happen — a data-only bundle deploy can prune the artifact a live reference still names, which is the path an earlier version of this guard left open — and `deploy-infrastructure` and `deploy-databricks` both require it to have _passed_, not merely not-failed. Neither `deploy_infrastructure=false` nor the change-detection route bypasses it: those inputs decide whether a job runs, not whether it is allowed to. The guard binds the target environment, so it reads with the same credentials the established Databricks deployment uses, and it exits before any workspace call for an environment whose Terraform names no OpenJII wheel.

The same checks run by hand:

```bash
# what the live resources actually reference (both must agree)
python scripts/live_wheel_refs.py --environment dev

# every wheel the committed dev Terraform references must already be uploaded
python scripts/check_wheel_artifacts.py --environment dev

# ...plus retention of the outgoing wheel, which is the phase-7 gate
python scripts/check_wheel_artifacts.py --environment dev \
  --require-previous openjii-0.1.0-py3-none-any.whl

# retention alone, for cleanup after a failed deploy where the new wheel may
# legitimately not exist yet
python scripts/check_wheel_artifacts.py --environment dev \
  --require-previous openjii-0.1.0-py3-none-any.whl --previous-only

# every grant the authoritative rule set carries, and whether Terraform declares it
# (reads `account access-control get-rule-set <NAME> ""` -- name and etag, two
# positionals; a third argument is rejected before authentication)
python scripts/inventory_run_as_acl.py --account-id "$DATABRICKS_ACCOUNT_ID" \
  --node-application-id <node-sp> --ci-application-id <ci-sp> --output acl.json \
  --etag-output acl-etag.txt

# ...and, immediately before an apply, that it has not changed since the review
python scripts/inventory_run_as_acl.py --account-id "$DATABRICKS_ACCOUNT_ID" \
  --node-application-id <node-sp> --ci-application-id <ci-sp> \
  --require-etag "$(cat acl-etag.txt)"
```

If the outgoing wheel was pruned by the upload, stop: restore it from the snapshot, or apply the environment's Terraform reference bump before anything that depends on it can start.

## Building & deploying

`pnpm build` produces wheels for every lib via `uv build --all-packages` (these end up in `dist/`).

The Databricks bundle (`databricks.yml`) builds wheels and uploads notebooks via `databricks bundle deploy`. CI for that is in [.github/workflows/deploy-databricks.yml](../../.github/workflows/deploy-databricks.yml). The DLT pipeline and the operational jobs live in terraform; the only bundle-owned resource is the `centrum_v3_sql_objects` job, because the SQL it registers ships inside the `openjii` wheel.

A change that moves a live Terraform wheel reference does **not** go through the ordinary release workflow — see "Rolling out an `openjii` wheel version bump" above. Everything else does.
