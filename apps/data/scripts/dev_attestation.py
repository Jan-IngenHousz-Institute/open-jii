#!/usr/bin/env python3
"""Publish and verify the dev attestation production is gated on.

A production rollout must prove that *this* release was rolled out to dev
successfully -- not merely that some run of the same workflow for the same commit
succeeded. `gh run view --json` does not expose workflow_dispatch inputs, so it
cannot tell a dev run from a prod one, and a run whose optional phases were skipped
still reports success.

So dev publishes a record of what it actually did, and prod validates that record
field by field. Every field is required: writing refuses to produce a partial
attestation, and verification refuses to accept one.

    python scripts/dev_attestation.py write --output attestation.json \
      --target dev --sha "$SHA" --workflow-path .github/workflows/data-wheel-rollout.yml \
      --run-id 1 --run-attempt 1 --old-wheel openjii-0.1.0-py3-none-any.whl \
      --new-wheel openjii-0.2.0-py3-none-any.whl --acl-plan-digest a --full-plan-digest b \
      --policy-wheel openjii-0.2.0-py3-none-any.whl --job-wheel openjii-0.2.0-py3-none-any.whl \
      --update-id 42 --update-state COMPLETED --full-refresh false --smoke-run-id 7 --smoke-state SUCCESS

    python scripts/dev_attestation.py verify --attestation attestation.json \
      --sha "$SHA" --new-wheel openjii-0.2.0-py3-none-any.whl --dev-run-id 1 \
      --run-path .github/workflows/data-wheel-rollout.yml --run-event workflow_dispatch \
      --run-conclusion success --run-head-sha "$SHA" --run-attempt 1

The run facts are read from the Actions API (`gh api repos/:owner/:repo/actions/runs/<id>`),
not from the attestation, so a file someone hand-wrote and attached to an unrelated
run cannot pass: the two independent sources have to agree.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

SCHEMA = "openjii.dev-rollout-attestation/1"

# The only workflow whose runs may carry this attestation. A run id belonging to any
# other workflow -- including one an attacker can trigger cheaply -- is refused.
WORKFLOW_PATH = ".github/workflows/data-wheel-rollout.yml"
RUN_EVENT = "workflow_dispatch"
RUN_CONCLUSION = "success"

# Field shapes. The point is not tidiness: a run id that is not a run id, or a wheel
# name that is not a wheel name, means the field was filled from something other than
# the phase it claims to record.
DIGITS = re.compile(r"[0-9]{1,20}")
HEX64 = re.compile(r"[0-9a-f]{64}")
SHA40 = re.compile(r"[0-9a-f]{40}")
WHEEL = re.compile(r"[A-Za-z0-9_.]+-\d[A-Za-z0-9_.!+]*-py3-none-any\.whl")
FIELD_SHAPES = {
    "sha": SHA40,
    "run_id": DIGITS,
    "run_attempt": DIGITS,
    "old_wheel": WHEEL,
    "new_wheel": WHEEL,
    "policy_wheel": WHEEL,
    "job_wheel": WHEEL,
    "acl_plan_digest": HEX64,
    "full_plan_digest": HEX64,
    "update_id": DIGITS,
    "smoke_run_id": DIGITS,
}

# A dev rollout only counts when the pipeline update reached a successful terminal
# state. Anything else -- still running, failed, cancelled -- must not open prod.
TERMINAL_SUCCESS = frozenset({"COMPLETED"})
# The smoke records a Jobs API result state / termination code, and the only value
# either enum defines for success is exactly SUCCESS. `TERMINATED_SUCCESS` is not in
# the pinned SDK at all; accepting it meant accepting a string nothing produces,
# which is the shape of a value someone typed rather than a run that passed.
SMOKE_SUCCESS = frozenset({"SUCCESS"})

REQUIRED_FIELDS = (
    "schema",
    "target",
    "sha",
    "workflow_path",
    "run_id",
    "run_attempt",
    "old_wheel",
    "new_wheel",
    "acl_plan_digest",
    "full_plan_digest",
    "policy_wheel",
    "job_wheel",
    "update_id",
    "update_state",
    "full_refresh",
    "smoke_run_id",
    "smoke_state",
)


class AttestationError(RuntimeError):
    """The attestation is absent, partial, or not for this release."""


def build(values: dict) -> dict:
    attestation = {"schema": SCHEMA, **values}
    missing = [field for field in REQUIRED_FIELDS if not str(attestation.get(field) or "").strip()]
    if missing:
        raise AttestationError(
            f"refusing to publish a partial attestation; missing {missing}. Every required "
            "phase must have run: a rollout with the pipeline update or the SQL smoke "
            "skipped is not a completed dev rollout."
        )
    return attestation


def check_shapes(attestation: dict) -> None:
    """Every recorded value has to look like the thing it claims to be."""
    wrong = [
        f"{field}={attestation.get(field)!r}"
        for field, pattern in FIELD_SHAPES.items()
        if not pattern.fullmatch(str(attestation.get(field) or "").strip())
    ]
    if wrong:
        raise AttestationError(
            f"these attestation fields are not the shape they must be: {wrong}. A synthesized "
            "or hand-edited record fails here even when every field is non-empty."
        )


def check_run(attestation: dict, run: dict, dev_run_id: str, sha: str) -> None:
    """Cross-check the attestation against the Actions run that supposedly produced it.

    The attestation is an artifact: whoever can write to the repo's Actions can attach
    one to a run. So the run itself is interrogated independently -- which workflow
    file it is, how it was triggered, whether it succeeded, which commit it built, and
    which attempt -- and every fact has to agree with both the attestation and the
    operator's `dev_run_id`.
    """
    supplied = str(dev_run_id or "").strip()
    if not DIGITS.fullmatch(supplied):
        raise AttestationError(f"dev_run_id {dev_run_id!r} is not a run id")

    facts = {
        key: str(run.get(key) or "").strip()
        for key in ("id", "path", "event", "conclusion", "head_sha", "run_attempt")
    }
    absent = sorted(key for key, value in facts.items() if not value)
    if absent:
        raise AttestationError(
            f"the Actions run facts are incomplete; missing {absent}. Verification needs "
            "the live run record, not just the attestation."
        )

    if facts["path"] != WORKFLOW_PATH:
        raise AttestationError(
            f"run {supplied} is {facts['path']!r}, not {WORKFLOW_PATH!r}: a successful run of "
            "some other workflow does not attest a dev rollout"
        )
    if WORKFLOW_PATH not in str(attestation.get("workflow_path") or ""):
        raise AttestationError(
            f"the attestation names workflow {attestation.get('workflow_path')!r}, which is not {WORKFLOW_PATH!r}"
        )
    if facts["event"] != RUN_EVENT:
        raise AttestationError(f"run {supplied} was triggered by {facts['event']!r}, not {RUN_EVENT!r}")
    if facts["conclusion"] != RUN_CONCLUSION:
        raise AttestationError(f"run {supplied} concluded {facts['conclusion']!r}, not {RUN_CONCLUSION!r}")
    if facts["id"] != supplied:
        raise AttestationError(
            f"the run record is for {facts['id']!r}, not the supplied dev_run_id {supplied!r}"
        )
    if str(attestation.get("run_id")).strip() != supplied:
        raise AttestationError(
            f"the attestation was produced by run {attestation.get('run_id')!r}, not the supplied "
            f"dev_run_id {supplied!r}: it was downloaded from a run that did not create it"
        )
    if facts["head_sha"] != sha:
        raise AttestationError(f"run {supplied} built {facts['head_sha']!r}, not this commit {sha!r}")
    if facts["run_attempt"] != str(attestation.get("run_attempt")).strip():
        raise AttestationError(
            f"run {supplied} is on attempt {facts['run_attempt']!r} but the attestation records "
            f"attempt {attestation.get('run_attempt')!r}: a later attempt may have rolled back"
        )


def verify(
    attestation: dict, sha: str, new_wheel: str, run: dict, dev_run_id: str, target: str = "dev"
) -> None:
    """Raise unless this attestation records a complete dev rollout of this release."""
    missing = [field for field in REQUIRED_FIELDS if not str(attestation.get(field) or "").strip()]
    if missing:
        raise AttestationError(f"the attestation is partial; missing {missing}")
    if attestation.get("schema") != SCHEMA:
        raise AttestationError(f"unknown attestation schema {attestation.get('schema')!r}")
    if attestation.get("target") != target:
        raise AttestationError(
            f"the supplied run targeted {attestation.get('target')!r}, not {target!r}. A "
            "successful prod run cannot stand in for the dev rollout."
        )
    if attestation.get("sha") != sha:
        raise AttestationError(f"the attestation is for {attestation.get('sha')!r}, not this commit {sha!r}")
    if attestation.get("new_wheel") != new_wheel:
        raise AttestationError(
            f"the attestation rolled out {attestation.get('new_wheel')!r}, not {new_wheel!r}"
        )
    if attestation.get("old_wheel") == attestation.get("new_wheel"):
        raise AttestationError("the attestation records no wheel transition at all")
    for field in ("policy_wheel", "job_wheel"):
        if attestation.get(field) != new_wheel:
            raise AttestationError(
                f"dev's {field} read back {attestation.get(field)!r}, not {new_wheel!r}: the "
                "live references were never proven"
            )
    if str(attestation.get("full_refresh")).strip().lower() != "false":
        raise AttestationError(
            f"the dev pipeline update ran with full_refresh={attestation.get('full_refresh')!r}; "
            "a full refresh restates history and cannot gate production"
        )
    if attestation.get("update_state") not in TERMINAL_SUCCESS:
        raise AttestationError(
            f"the dev pipeline update ended {attestation.get('update_state')!r}, not a "
            f"successful terminal state {sorted(TERMINAL_SUCCESS)}"
        )
    if attestation.get("smoke_state") not in SMOKE_SUCCESS:
        raise AttestationError(
            f"the dev SQL/replay smoke ended {attestation.get('smoke_state')!r}, not {sorted(SMOKE_SUCCESS)}"
        )
    check_shapes(attestation)
    check_run(attestation, run, dev_run_id, sha)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    writer = subparsers.add_parser("write")
    writer.add_argument("--output", required=True)
    for field in REQUIRED_FIELDS:
        if field == "schema":
            continue
        writer.add_argument(f"--{field.replace('_', '-')}", default="")

    verifier = subparsers.add_parser("verify")
    verifier.add_argument("--attestation", required=True)
    verifier.add_argument("--sha", required=True)
    verifier.add_argument("--new-wheel", required=True)
    verifier.add_argument("--target", default="dev")
    verifier.add_argument("--dev-run-id", required=True, help="the operator-supplied dev run id")
    # Read from the Actions API, independently of the attestation file.
    verifier.add_argument("--run-path", required=True, help="the run's workflow file path")
    verifier.add_argument("--run-event", required=True)
    verifier.add_argument("--run-conclusion", required=True)
    verifier.add_argument("--run-head-sha", required=True)
    verifier.add_argument("--run-attempt", required=True)
    verifier.add_argument("--run-id", required=True, help="the run id the API reported for itself")

    arguments = parser.parse_args(argv)
    try:
        if arguments.command == "write":
            values = {field: getattr(arguments, field) for field in REQUIRED_FIELDS if field != "schema"}
            attestation = build(values)
            pathlib.Path(arguments.output).write_text(
                json.dumps(attestation, indent=2, sort_keys=True) + "\n"
            )
            print(json.dumps(attestation, indent=2, sort_keys=True))
        else:
            attestation = json.loads(pathlib.Path(arguments.attestation).read_text())
            print(json.dumps(attestation, indent=2, sort_keys=True))
            run = {
                "id": arguments.run_id,
                "path": arguments.run_path,
                "event": arguments.run_event,
                "conclusion": arguments.run_conclusion,
                "head_sha": arguments.run_head_sha,
                "run_attempt": arguments.run_attempt,
            }
            verify(
                attestation,
                arguments.sha,
                arguments.new_wheel,
                run,
                arguments.dev_run_id,
                arguments.target,
            )
            print("Dev attestation verified for this release.")
    except AttestationError as error:
        print(f"DEV ATTESTATION FAILED: {error}", file=sys.stderr)
        return 1
    except (OSError, json.JSONDecodeError) as error:
        print(f"DEV ATTESTATION FAILED: cannot read the attestation: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
