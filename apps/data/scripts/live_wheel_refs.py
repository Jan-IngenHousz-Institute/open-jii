#!/usr/bin/env python3
"""Read the OpenJII wheel the live resources actually reference.

Two live resources name the wheel by filename: the centrum cluster policy and the
Data Export job. They are the reason the rollout has to be two-phase, so the
outgoing filename is derived from them rather than typed in by the operator -- a
free-text "previous wheel" input can be satisfied by any file that happens to be
in the artifact directory, which proves nothing about what is live.

Both must agree. If they disagree, a previous rollout stopped half way and that has
to be resolved before another one starts.

    # derive the outgoing wheel (fails if the two live resources disagree)
    python scripts/live_wheel_refs.py --environment dev --output outgoing.txt

    # post-apply readback: both must name exactly the new wheel and nothing stale
    python scripts/live_wheel_refs.py --environment dev \
      --expect openjii-0.2.0-py3-none-any.whl

    # transition detection for the ordinary deploy guard
    python scripts/live_wheel_refs.py --environment dev \
      --expect-committed 0.2.0 --pointer
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys

OPENJII_WHEEL = re.compile(r"openjii-[A-Za-z0-9_.!+]+-py3-none-any\.whl")

POLICY_NAME = "centrum-pipeline-cluster-policy-{environment}"
EXPORT_JOB_NAME = "Data-Export-Job-{environment_upper}"

TWO_PHASE_POINTER = (
    "The live OpenJII wheel reference does not match this commit, so applying "
    "Terraform now would point live resources at a wheel that is not uploaded.\n"
    "\n"
    "Use the two-phase rollout instead of the ordinary deployment workflow:\n"
    "  .github/workflows/data-wheel-rollout.yml  (Actions > 'Data wheel rollout')\n"
    "It applies the run-as ACL on its own, proves the role as the CI principal, "
    "uploads the wheel, requires both the old and the new wheel to be present, and "
    "only then reconciles the full environment.\n"
    "See apps/data/README.md, 'Rolling out an openjii wheel version bump'."
)


class LiveRefError(RuntimeError):
    """The live references cannot be read, or they disagree."""


def openjii_wheels(text: str) -> set[str]:
    """Every OpenJII wheel filename mentioned in a resource definition."""
    return set(OPENJII_WHEEL.findall(text or ""))


def sole_wheel(source: str, wheels: set[str]) -> str:
    if not wheels:
        raise LiveRefError(f"{source} references no OpenJII wheel")
    if len(wheels) > 1:
        raise LiveRefError(f"{source} references more than one OpenJII wheel: {sorted(wheels)}")
    return next(iter(wheels))


def agreed_wheel(policy_wheel: str, job_wheel: str) -> str:
    """The single wheel both live resources name, or an error."""
    if policy_wheel != job_wheel:
        raise LiveRefError(
            f"the live resources disagree: cluster policy names {policy_wheel!r} and the "
            f"Data Export job names {job_wheel!r}. A previous rollout stopped part-way; "
            "reconcile them before starting another."
        )
    return policy_wheel


def _cli_json(arguments: list[str]) -> object:
    completed = subprocess.run(["databricks", *arguments], capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        raise LiveRefError(
            f"`databricks {' '.join(arguments)}` failed: "
            f"{(completed.stderr or completed.stdout or '').strip()}"
        )
    output = (completed.stdout or "").strip()
    return json.loads(output) if output else []


def _cli_list(arguments: list[str]) -> list[dict]:
    """A CLI response that must be a JSON list of objects."""
    payload = _cli_json(arguments)
    if not payload:
        return []
    if not isinstance(payload, list):
        raise LiveRefError(f"`databricks {' '.join(arguments)}` did not return a JSON list")
    return [entry for entry in payload if isinstance(entry, dict)]


def read_cluster_policy(environment: str) -> str:
    name = POLICY_NAME.format(environment=environment)
    policies = _cli_list(["cluster-policies", "list", "--output", "json"])
    for policy in policies:
        if policy.get("name") == name:
            return json.dumps(policy)
    raise LiveRefError(f"cluster policy {name!r} not found")


def read_export_job(environment: str) -> str:
    name = EXPORT_JOB_NAME.format(environment_upper=environment.upper())
    jobs = _cli_list(["jobs", "list", "--output", "json"])
    for job in jobs:
        settings = job.get("settings") or {}
        if settings.get("name") == name:
            job_id = job.get("job_id")
            # The list response truncates settings; read the job to see libraries.
            return json.dumps(_cli_json(["jobs", "get", str(job_id), "--output", "json"]))
    raise LiveRefError(f"job {name!r} not found")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment", required=True)
    parser.add_argument("--policy-file", help="read the policy definition from a file (tests)")
    parser.add_argument("--job-file", help="read the job definition from a file (tests)")
    parser.add_argument("--expect", help="require both live references to be exactly this wheel")
    parser.add_argument(
        "--expect-committed",
        help="require the live wheel to be openjii-<this version>-py3-none-any.whl",
    )
    parser.add_argument("--output", help="write the derived outgoing wheel filename here")
    parser.add_argument(
        "--pointer",
        action="store_true",
        help="on mismatch, print the two-phase rollout pointer (for the deploy guard)",
    )
    arguments = parser.parse_args(argv)

    try:
        policy = (
            pathlib.Path(arguments.policy_file).read_text()
            if arguments.policy_file
            else read_cluster_policy(arguments.environment)
        )
        job = (
            pathlib.Path(arguments.job_file).read_text()
            if arguments.job_file
            else read_export_job(arguments.environment)
        )

        policy_wheel = sole_wheel("the cluster policy", openjii_wheels(policy))
        job_wheel = sole_wheel("the Data Export job", openjii_wheels(job))
        print(f"cluster policy: {policy_wheel}")
        print(f"data export job: {job_wheel}")
        live = agreed_wheel(policy_wheel, job_wheel)

        expected = arguments.expect
        if arguments.expect_committed:
            expected = f"openjii-{arguments.expect_committed}-py3-none-any.whl"
        if expected and live != expected:
            message = f"live resources reference {live!r}, expected {expected!r}" + (
                f"\n\n{TWO_PHASE_POINTER}" if arguments.pointer else ""
            )
            raise LiveRefError(message)

        if arguments.output:
            pathlib.Path(arguments.output).write_text(live + "\n")
        print(f"live OpenJII wheel: {live}")
    except LiveRefError as error:
        print(f"LIVE WHEEL REFERENCE CHECK FAILED: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
