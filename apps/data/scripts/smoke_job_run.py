#!/usr/bin/env python3
"""Start the SQL/replay smoke job by its real job id and poll its real run id.

`databricks bundle run <key> --no-wait` cannot be used for this. In the pinned CLI
(v0.298.0) the job runner's no-wait branch returns no run output, so the command
prints a run URL and marshals nothing: there is no `run_id` on stdout to capture.
A phase that needs to record *which* Databricks run proved the release therefore
cannot start it that way.

So the job is resolved to an id from the machine-readable bundle summary, started
through the Jobs command whose documented response carries `run_id`, and polled by
that exact id:

    databricks bundle summary -t <target> --output json  ->  resources.jobs.<key>
    databricks jobs run-now <JOB_ID> --no-wait --output json  ->  {"run_id": ...}
    databricks jobs get-run <RUN_ID> --output json           ->  terminal state

Nothing here defaults. A summary without the job, a start response without a
numeric run id, a non-terminal run at the deadline, or anything other than the
coherent pair TERMINATED/SUCCESS all exit non-zero, because the dev attestation
this feeds is what opens production. `SKIPPED` (another run was already active) and
`INTERNAL_ERROR` (a Jobs service failure) are terminal failures even when a
success-looking result accompanies them.

    python scripts/smoke_job_run.py --summary-file summary.json \
      --job-key centrum_v3_sql_objects --output-file "$GITHUB_OUTPUT"
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys
import time

DIGITS = re.compile(r"[0-9]{1,20}")

# The only state a successful smoke can be in. Success is a *pair*: the run reached
# TERMINATED and its result is exactly SUCCESS. Nothing else counts -- SKIPPED means
# the run was abandoned because another was already active, INTERNAL_ERROR is a Jobs
# service failure, and either of those arriving next to a success-looking result is a
# contradictory response, not a green smoke.
TERMINAL_SUCCESS = ("TERMINATED", "SUCCESS")

# Terminal and definitely not success, whatever result accompanies them.
TERMINAL_FAILURES = frozenset({"SKIPPED", "INTERNAL_ERROR"})

# Everything the pinned SDK can report while a run is still going. A value outside
# this set and the terminal ones above cannot be interpreted, so it fails closed
# rather than being polled until the deadline.
RUNNING_LIFE_CYCLES = frozenset(
    {"PENDING", "RUNNING", "TERMINATING", "BLOCKED", "WAITING_FOR_RETRY", "QUEUED", "WAITING"}
)


class SmokeRunError(RuntimeError):
    """The smoke run cannot be identified, started, or proven successful."""


def run_cli(arguments: list[str]) -> str:
    completed = subprocess.run(
        ["databricks", *arguments],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise SmokeRunError(
            f"`databricks {' '.join(arguments)}` failed ({completed.returncode}): "
            f"{(completed.stderr or completed.stdout or '').strip()}"
        )
    return completed.stdout


def _cli_json(arguments: list[str]) -> object:
    output = (run_cli(arguments) or "").strip()
    if not output:
        raise SmokeRunError(f"`databricks {' '.join(arguments)}` returned nothing")
    try:
        return json.loads(output)
    except json.JSONDecodeError as error:
        raise SmokeRunError(f"`databricks {' '.join(arguments)}` returned non-JSON: {error}") from error


def summary_job(summary: dict, job_key: str) -> dict:
    """The resolved bundle's entry for this job key."""
    jobs = (summary.get("resources") or {}).get("jobs") or {}
    job = jobs.get(job_key)
    if not isinstance(job, dict):
        raise SmokeRunError(
            f"the bundle summary has no job {job_key!r} (it declares {sorted(jobs)}). "
            "The smoke job is part of this bundle, so an absent key means the deploy "
            "phase did not deploy what this phase is about to attest."
        )
    return job


def job_id_from_summary(summary: dict, job_key: str) -> str | None:
    """The deployed job id, when the summary carries it.

    `bundle summary` fills each resource's `id` from deployed state, so after the
    deploy phase this is the direct answer. It is optional here only because the
    field is deployment state rather than configuration; when it is absent the
    caller falls back to an exact-name lookup through the Jobs API.
    """
    identifier = str(summary_job(summary, job_key).get("id") or "").strip()
    return identifier if DIGITS.fullmatch(identifier) else None


def job_name_from_summary(summary: dict, job_key: str) -> str:
    """The resolved job name. Configuration, so the summary always carries it."""
    name = str(summary_job(summary, job_key).get("name") or "").strip()
    if not name:
        raise SmokeRunError(f"job {job_key!r} in the bundle summary has no resolved name")
    return name


def job_id_by_name(name: str) -> str:
    """Exactly one deployed job with this exact name, or an error.

    `jobs list --name` filters case-insensitively, so the exact name is re-checked
    here: starting the wrong job and attesting its result would be worse than
    failing the phase.
    """
    listed = _cli_json(["jobs", "list", "--name", name, "--output", "json"]) or []
    if not isinstance(listed, list):
        raise SmokeRunError("`databricks jobs list` did not return a JSON list")
    matches = [
        str(job.get("job_id"))
        for job in listed
        if isinstance(job, dict) and (job.get("settings") or {}).get("name") == name
    ]
    if len(matches) != 1:
        raise SmokeRunError(
            f"expected exactly one deployed job named {name!r}, found {len(matches)}: {matches}"
        )
    if not DIGITS.fullmatch(matches[0]):
        raise SmokeRunError(f"job {name!r} has an implausible job_id {matches[0]!r}")
    return matches[0]


def resolve_job_id(summary: dict, job_key: str) -> str:
    return job_id_from_summary(summary, job_key) or job_id_by_name(job_name_from_summary(summary, job_key))


def start_run(job_id: str) -> str:
    """Start the job and return the run id its response carries.

    `jobs run-now` is the documented Jobs API operation whose response is
    `RunNowResponse{run_id, number_in_job}`; `--no-wait` returns as soon as the run
    is created, which is what makes the id available for polling.
    """
    response = _cli_json(["jobs", "run-now", job_id, "--no-wait", "--output", "json"])
    if not isinstance(response, dict):
        raise SmokeRunError(f"unexpected run-now response for job {job_id}: {response!r}")
    run_id = str(response.get("run_id") or "").strip()
    if not DIGITS.fullmatch(run_id):
        raise SmokeRunError(
            f"no numeric run_id in the run-now response for job {job_id}: {response!r}. "
            "Refusing to attest a smoke run that cannot be identified."
        )
    return run_id


def _raw_enum(container: dict, field: str, where: str) -> str | None:
    """The field's value exactly as it arrived, or None when the key is absent.

    No coercion, no trimming, no case folding: the pinned enums are exact strings,
    and a value that needed rewriting to match one is a value the API did not send.
    `" TERMINATED "` is not `TERMINATED`.
    """
    if field not in container:
        return None
    value = container[field]
    if not isinstance(value, str) or not value:
        raise SmokeRunError(
            f"{where}.{field} is {value!r}, not one of the documented enum strings; "
            "refusing to interpret a malformed run response"
        )
    return value


def _legacy_pair(state: object) -> tuple[str, str | None]:
    if not isinstance(state, dict):
        raise SmokeRunError(f"the run response has a `state` member that is not an object: {state!r}")
    life_cycle = _raw_enum(state, "life_cycle_state", "state")
    if life_cycle is None:
        raise SmokeRunError(f"the run response has a `state` member with no life_cycle_state: {state!r}")
    return life_cycle, _raw_enum(state, "result_state", "state")


def _current_pair(status: object) -> tuple[str, str | None]:
    if not isinstance(status, dict):
        raise SmokeRunError(f"the run response has a `status` member that is not an object: {status!r}")
    life_cycle = _raw_enum(status, "state", "status")
    if life_cycle is None:
        raise SmokeRunError(f"the run response has a `status` member with no state: {status!r}")
    details = status.get("termination_details")
    if "termination_details" in status and not isinstance(details, dict):
        raise SmokeRunError(
            f"the run response has a `status.termination_details` that is not an object: {details!r}"
        )
    return life_cycle, _raw_enum(details or {}, "code", "status.termination_details")


def run_state(run: dict) -> tuple[str, str | None]:
    """The one raw (life cycle, result) pair this response reports.

    A run carries the legacy `state` shape, the current `status` shape, or both.
    **Presence of the key is what counts, not whether its contents look useful**: a
    `state` that is `{}`, `null` or a string is a malformed response, not an absent
    shape, and letting it fall away would leave its well-formed sibling to attest
    success on its own.

    When both keys are present the two raw pairs must be exactly equal. Taking the
    lifecycle from one and the result from the other -- or accepting values that only
    match after normalization -- is how a response that disagrees with itself becomes
    a green smoke.
    """
    shapes: dict[str, tuple[str, str | None]] = {}
    if "state" in run:
        shapes["state"] = _legacy_pair(run["state"])
    if "status" in run:
        shapes["status"] = _current_pair(run["status"])

    if not shapes:
        raise SmokeRunError(
            "the run response reports no state at all; refusing to guess whether the smoke succeeded"
        )
    if len(shapes) == 2 and shapes["state"] != shapes["status"]:
        raise SmokeRunError(
            f"the run response contradicts itself: legacy state {shapes['state']} but "
            f"current status {shapes['status']}. A response that disagrees with itself "
            "cannot attest anything."
        )
    return next(iter(shapes.values()))


def poll_run(run_id: str, attempts: int, interval: float, sleep=time.sleep) -> str:
    """Poll until the run is over. Returns the result state; raises unless it succeeded.

    The only accepted outcome is the coherent pair TERMINATED/SUCCESS.
    """
    for attempt in range(1, attempts + 1):
        run = _cli_json(["jobs", "get-run", run_id, "--output", "json"])
        if not isinstance(run, dict):
            raise SmokeRunError(f"unexpected get-run response for run {run_id}: {run!r}")
        life_cycle, result = run_state(run)
        print(f"attempt {attempt}: {life_cycle}/{result if result is not None else '(no result)'}")

        if (life_cycle, result) == TERMINAL_SUCCESS:
            return TERMINAL_SUCCESS[1]
        if life_cycle in TERMINAL_FAILURES:
            # Terminal and not success, whatever the result says. SKIPPED next to
            # SUCCESS is a contradictory response, not a run that passed.
            raise SmokeRunError(
                f"smoke run {run_id} ended {life_cycle}/{result or '(no result)'}: "
                f"only {TERMINAL_SUCCESS[0]}/{TERMINAL_SUCCESS[1]} is a successful smoke"
            )
        if life_cycle == TERMINAL_SUCCESS[0]:
            if result is not None:
                raise SmokeRunError(f"smoke run {run_id} ended {life_cycle}/{result}")
            # Terminated with no result yet: keep polling for the coherent pair
            # rather than reading the absence as either outcome.
        elif life_cycle not in RUNNING_LIFE_CYCLES:
            raise SmokeRunError(
                f"smoke run {run_id} reports the unknown state {life_cycle!r}; refusing to "
                "interpret a state the pinned Jobs API does not define"
            )

        if attempt < attempts:
            sleep(interval)
    raise SmokeRunError(f"smoke run {run_id} did not reach a terminal state in time")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--summary-file", required=True, help="`bundle summary --output json`")
    parser.add_argument("--job-key", required=True, help="the bundle resource key of the smoke job")
    parser.add_argument("--output-file", help="append run_id/state here, for $GITHUB_OUTPUT")
    parser.add_argument("--attempts", type=int, default=120)
    parser.add_argument("--interval", type=float, default=15.0)
    arguments = parser.parse_args(argv)

    try:
        summary = json.loads(pathlib.Path(arguments.summary_file).read_text())
        job_id = resolve_job_id(summary, arguments.job_key)
        print(f"smoke job {arguments.job_key} is job {job_id}")

        run_id = start_run(job_id)
        print(f"smoke job run {run_id}")
        if arguments.output_file:
            # Written before polling: a run that starts and then times out must still
            # be identifiable from the workflow log.
            with open(arguments.output_file, "a") as handle:
                handle.write(f"run_id={run_id}\n")

        result = poll_run(run_id, arguments.attempts, arguments.interval)
        if arguments.output_file:
            with open(arguments.output_file, "a") as handle:
                handle.write(f"state={result}\n")
        print(f"smoke run {run_id} finished {result}")
    except SmokeRunError as error:
        print(f"SMOKE RUN FAILED: {error}", file=sys.stderr)
        return 1
    except (OSError, json.JSONDecodeError) as error:
        print(f"SMOKE RUN FAILED: cannot read the bundle summary: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
