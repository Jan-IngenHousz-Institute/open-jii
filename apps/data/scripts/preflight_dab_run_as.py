#!/usr/bin/env python3
"""Preflight the bundle as the identity that will actually deploy it.

`databricks bundle validate` proves the YAML resolves; it does not prove the
deploying principal is allowed to assign the `run_as` identity the jobs name.
Assigning `run_as.service_principal_name` requires the deployer to hold the
Service Principal User role (`roles/servicePrincipal.user`) on that principal --
codified in `infrastructure/env/{dev,prod}/main.tf` as a
`databricks_access_control_rule_set`. Workspace membership is not that role and
Service Principal Manager does not inherit it, so a deploy can validate cleanly
and then fail while creating the job.

This script runs before `bundle deploy` and fails first. Two phases:

  1. **Read-only.** Resolve the authenticated identity, resolve every `run_as`
     principal the bundle names, and assert the resolved job configuration
     (run identity, no group holds CAN_MANAGE, the wheel matches the built
     version, the smoke task exposes no schema input).
  2. **Authorization probe** (``--prove-run-as``). Create a disposable, paused,
     task-less job whose only content is `run_as`, then delete it in a `finally`.
     This is the one operation that actually exercises the role. It touches no
     data, no schema and none of the bundle's resources; if the role is missing
     it fails here instead of half-way through a real deploy.

Usage:

    python scripts/preflight_dab_run_as.py --target dev --prove-run-as
    python scripts/preflight_dab_run_as.py --target dev --summary-file plan.json

Exit status is non-zero on the first failed expectation, and nothing is deployed.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys
from typing import Any

PROBE_JOB_PREFIX = "zz-preflight-run-as-"


class PreflightError(RuntimeError):
    """A precondition failed; the caller must not proceed to deploy."""


def run_cli(args: list[str], *, capture: bool = True) -> str:
    """Run the Databricks CLI, raising PreflightError with its stderr."""
    completed = subprocess.run(
        ["databricks", *args],
        capture_output=capture,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise PreflightError(
            f"`databricks {' '.join(args)}` failed ({completed.returncode}): "
            f"{(completed.stderr or completed.stdout or '').strip()}"
        )
    return completed.stdout


def bundle_summary(target: str, summary_file: str | None) -> dict:
    """The resolved bundle configuration, as the deploying identity sees it."""
    if summary_file:
        with open(summary_file) as handle:
            return json.load(handle)
    return json.loads(run_cli(["bundle", "summary", "-t", target, "--output", "json"]))


def run_as_principals(summary: dict) -> dict[str, str]:
    """Map every job in the resolved bundle to the principal it will run as."""
    jobs = (summary.get("resources") or {}).get("jobs") or {}
    principals: dict[str, str] = {}
    for name, job in jobs.items():
        run_as = job.get("run_as") or {}
        principal = run_as.get("service_principal_name") or run_as.get("user_name")
        if not principal:
            raise PreflightError(
                f"job {name!r} resolves without a run_as identity; it would run as "
                "whoever deployed it, which is not the identity holding the catalog grants"
            )
        if not run_as.get("service_principal_name"):
            raise PreflightError(f"job {name!r} resolves to a user run_as ({principal!r})")
        if principal.startswith("${"):
            raise PreflightError(
                f"job {name!r} run_as did not resolve ({principal!r}); the variable lookup "
                "failed, which usually means the service principal display name is wrong"
            )
        principals[name] = principal
    if not principals:
        raise PreflightError("the resolved bundle declares no jobs")
    return principals


# The one schema a task may legitimately be told about: where the shared v3
# objects live. It is never created or dropped by a task.
SCHEMA_PARAMETER_ALLOWLIST = frozenset({"CENTRAL_SCHEMA"})
_BOOLEAN_LITERALS = frozenset({"true", "false"})


def names_a_schema(key: str, value: Any) -> bool:
    """True when a job parameter could carry a schema name.

    ``KEEP_SCHEMA=false`` is a retention switch, not a schema, so a name-only rule
    would be noise. What must never appear is a parameter whose *value* a task
    could create or drop.
    """
    if "SCHEMA" not in key.upper() or key in SCHEMA_PARAMETER_ALLOWLIST:
        return False
    return str(value).strip().lower() not in _BOOLEAN_LITERALS


def check_resolved_jobs(summary: dict, expected_wheel_version: str | None) -> list[str]:
    """Assert the governance properties of the resolved jobs. Returns notes.

    ``expected_wheel_version`` is only optional so unit tests can exercise the other
    assertions in isolation; the CLI always resolves it (fail-closed) first.
    """
    notes: list[str] = []
    jobs = (summary.get("resources") or {}).get("jobs") or {}
    for name, job in jobs.items():
        for permission in job.get("permissions") or []:
            if permission.get("group_name") and permission.get("level") == "CAN_MANAGE":
                raise PreflightError(
                    f"job {name!r} grants CAN_MANAGE to group "
                    f"{permission['group_name']!r}; that allows editing a job that runs DDL"
                )
        for task in job.get("tasks") or []:
            parameters = (task.get("notebook_task") or {}).get("base_parameters") or {}
            for key, value in parameters.items():
                if names_a_schema(key, value):
                    raise PreflightError(
                        f"task {task.get('task_key')!r} of {name!r} passes {key}={value!r}, "
                        "which names a schema; the smoke test must generate and validate its "
                        "own scratch schema so no parameter can redirect its DROP"
                    )
        for environment in job.get("environments") or []:
            for dependency in (environment.get("spec") or {}).get("dependencies") or []:
                notes.append(f"{name}: depends on {dependency}")
                if expected_wheel_version and "openjii-" in dependency:
                    expected = f"openjii-{expected_wheel_version}-py3-none-any.whl"
                    if not dependency.endswith(expected):
                        raise PreflightError(
                            f"job {name!r} depends on {dependency!r}, but the built wheel is "
                            f"{expected!r}; serverless caches per version, so a stale "
                            "reference can serve the previous implementation"
                        )
    return notes


def probe_job_ids(name: str) -> list[str]:
    """Every job carrying this exact probe name.

    The fallback for a create whose response could not be parsed: the job may exist
    even though no id came back, and a probe left behind is a job with `run_as` set
    to the node principal that nobody is watching.
    """
    listed = json.loads(run_cli(["jobs", "list", "--name", name, "--output", "json"]) or "[]")
    return [
        str(job["job_id"])
        for job in listed or []
        if job.get("job_id") and (job.get("settings") or {}).get("name") == name
    ]


def prove_run_as(principal: str, token: str) -> None:
    """Create and delete a disposable paused job that only carries `run_as`.

    The single operation that actually exercises `roles/servicePrincipal.user`.

    Creation and response parsing are *inside* the protected block: a create that
    succeeds server-side but returns something this cannot parse -- truncated JSON, a
    changed response shape -- would otherwise leak the probe. When no id is recovered,
    cleanup falls back to looking the job up by its exact name and deletes every match
    before the failure propagates.
    """
    name = f"{PROBE_JOB_PREFIX}{token}"
    definition = {
        "name": name,
        "run_as": {"service_principal_name": principal},
        # No tasks and no schedule: nothing here can execute.
        "max_concurrent_runs": 1,
    }
    job_id: str | None = None
    try:
        created = json.loads(run_cli(["jobs", "create", "--json", json.dumps(definition)]) or "{}")
        if not isinstance(created, dict):
            raise PreflightError(f"probe job {name!r}: unexpected create response {created!r}")
        job_id = str(created.get("job_id") or "") or None
        if not job_id:
            raise PreflightError(f"probe job {name!r} was created without a job_id")
        print(f"  authorization probe ok: may assign run_as {principal}")
    except json.JSONDecodeError as error:
        raise PreflightError(f"probe job {name!r}: unparseable create response: {error}") from error
    finally:
        # Read before the cleanup can install an exception of its own.
        already_failing = sys.exc_info()[1] is not None
        try:
            for identifier in [job_id] if job_id else probe_job_ids(name):
                run_cli(["jobs", "delete", str(identifier)])
                print(f"  probe job {identifier} deleted")
        except (PreflightError, json.JSONDecodeError) as cleanup_error:
            # Never let cleanup swallow the failure that caused it; say both.
            print(f"  PROBE CLEANUP FAILED: delete {name!r} by hand: {cleanup_error}", file=sys.stderr)
            if not already_failing:
                raise


PYPROJECT = pathlib.Path(__file__).resolve().parents[1] / "src/lib/openjii/pyproject.toml"
_VERSION = re.compile(r'^version\s*=\s*"([^"]+)"', re.MULTILINE)


def expected_wheel_version(explicit: str | None = None, pyproject: pathlib.Path = PYPROJECT) -> str:
    """The version the deployed bundle must reference. Never optional.

    Read from the committed `pyproject.toml`, which exists in a clean CI checkout,
    rather than from an installed `openjii`: CI installs `build` and `pip`, not this
    package, so an import-based lookup silently disabled the check exactly where the
    dual-wheel rollout is most delicate. An explicit `--wheel-version` overrides it;
    if neither can be determined this raises rather than skipping.
    """
    if explicit:
        if not re.fullmatch(r"[A-Za-z0-9_.!+-]{1,32}", explicit):
            raise PreflightError(f"implausible --wheel-version {explicit!r}")
        return explicit
    if not pyproject.is_file():
        raise PreflightError(
            f"cannot determine the expected wheel version: {pyproject} is missing and no "
            "--wheel-version was given. Refusing to deploy without checking the reference."
        )
    match = _VERSION.search(pyproject.read_text())
    if not match:
        raise PreflightError(f"cannot determine the expected wheel version: no version field in {pyproject}")
    return match.group(1)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True, help="bundle target, e.g. dev")
    parser.add_argument(
        "--prove-run-as",
        action="store_true",
        help="additionally create and delete a disposable job to prove the role",
    )
    parser.add_argument(
        "--summary-file",
        help="read the resolved bundle from a file instead of calling the CLI",
    )
    parser.add_argument("--probe-token", default="preflight", help="suffix for the probe job name")
    parser.add_argument(
        "--wheel-version",
        help="expected openjii wheel version; defaults to the committed pyproject.toml",
    )
    args = parser.parse_args(argv)

    try:
        if not args.summary_file:
            identity = json.loads(run_cli(["current-user", "me", "--output", "json"]))
            print(f"Authenticated as {identity.get('userName') or identity.get('displayName') or identity}")
            run_cli(["bundle", "validate", "-t", args.target])
            print(f"bundle validate -t {args.target}: ok")

        summary = bundle_summary(args.target, args.summary_file)
        principals = run_as_principals(summary)
        for name, principal in principals.items():
            print(f"  {name} resolves to run_as {principal}")

        wheel_version = expected_wheel_version(args.wheel_version)
        print(f"  expecting wheel openjii-{wheel_version}-py3-none-any.whl")
        for note in check_resolved_jobs(summary, wheel_version):
            print(f"  {note}")
        print("resolved job governance: ok")

        if args.prove_run_as:
            for principal in sorted(set(principals.values())):
                prove_run_as(principal, args.probe_token)
        else:
            print(
                "NOTE: run with --prove-run-as to exercise roles/servicePrincipal.user; "
                "validate alone cannot prove it"
            )
    except PreflightError as error:
        print(f"PREFLIGHT FAILED: {error}", file=sys.stderr)
        return 1
    print("Preflight passed; deployment may proceed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
