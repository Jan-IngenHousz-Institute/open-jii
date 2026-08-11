#!/usr/bin/env python3
"""Refuse to apply Terraform that points live resources at a wheel nobody uploaded.

The centrum cluster policy and the data-export job name their libraries by
filename (`infrastructure/env/<env>/main.tf`). A bundle deploy is what puts that
file in the environment's artifact directory. So a Terraform apply that moves
those references to a new version *before* the bundle has uploaded it leaves live
resources pointing at nothing -- which surfaces later, on the next cluster start,
far from the change that caused it.

This checks the actual hazard rather than a proxy for it: every wheel filename the
committed Terraform references for an environment must already exist in that
environment's `.internal/` directory. It needs no diff against a previous commit,
so it works for manual releases; it self-clears as soon as the upload phase has
run; and it catches a hand-edited reference to a version that was never built.

Each environment has its own artifact directory, so a wheel uploaded to dev never
satisfies a production reference.

    python scripts/check_wheel_artifacts.py --environment dev
    python scripts/check_wheel_artifacts.py --environment dev --listing-file listing.json
    python scripts/check_wheel_artifacts.py --environment dev \
        --require-previous openjii-0.1.0-py3-none-any.whl --previous-only
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys

# openjii-0.2.0-py3-none-any.whl, ambyte-0.1.0-py3-none-any.whl, ...
WHEEL_PATTERN = re.compile(r"[A-Za-z0-9_.]+-\d[A-Za-z0-9_.!+]*-py3-none-any\.whl")

ARTIFACT_ROOT = "/Workspace/Shared/.bundle/open-jii"

TWO_PHASE_POINTER = (
    "This change moves a live Terraform library reference to a wheel that is not in "
    "the environment's artifact directory yet. Applying it now would leave the "
    "centrum cluster policy and/or the data-export job pointing at a missing file.\n"
    "\n"
    "Use the two-phase rollout instead of the ordinary deployment workflow:\n"
    "  .github/workflows/data-wheel-rollout.yml  (Actions > 'Data wheel rollout')\n"
    "It applies the run-as ACL on its own, proves the role as the CI principal, "
    "uploads the wheel, requires both the old and the new wheel to be present, and "
    "only then reconciles the full environment.\n"
    "See apps/data/README.md, 'Rolling out an openjii wheel version bump'."
)


class WheelArtifactError(RuntimeError):
    """The referenced wheels are not all present; the caller must not apply."""


def artifact_directory(environment: str) -> str:
    """The environment's own `.internal/` directory.

    Per-environment by construction: a dev upload cannot satisfy a prod reference.
    """
    if not re.fullmatch(r"[a-z0-9_-]{1,32}", environment or ""):
        raise WheelArtifactError(f"refusing to build an artifact path for {environment!r}")
    return f"{ARTIFACT_ROOT}/{environment}/artifacts/.internal"


def wheel_references(terraform: str) -> set[str]:
    """Every wheel filename the Terraform text names."""
    return set(WHEEL_PATTERN.findall(terraform))


def uploaded_wheels(listing: list[dict] | list[str]) -> set[str]:
    """Wheel filenames present in a `workspace list` result."""
    names: set[str] = set()
    for entry in listing or []:
        path = entry if isinstance(entry, str) else (entry.get("path") or entry.get("name") or "")
        name = path.rsplit("/", 1)[-1]
        if name.endswith(".whl"):
            names.add(name)
    return names


def missing_wheels(references: set[str], uploaded: set[str]) -> set[str]:
    """References with no corresponding uploaded artifact."""
    return {reference for reference in references if reference not in uploaded}


def list_workspace_directory(directory: str) -> list[dict]:
    """Read the artifact directory. An absent directory means nothing is uploaded."""
    completed = subprocess.run(
        ["databricks", "workspace", "list", directory, "--output", "json"],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        stderr = (completed.stderr or "").strip()
        if "RESOURCE_DOES_NOT_EXIST" in stderr or "doesn't exist" in stderr:
            return []
        raise WheelArtifactError(f"could not list {directory}: {stderr}")
    output = (completed.stdout or "").strip()
    return json.loads(output) if output else []


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment", required=True)
    parser.add_argument(
        "--terraform-file",
        help="defaults to infrastructure/env/<environment>/main.tf, relative to the repo root",
    )
    parser.add_argument(
        "--listing-file",
        help="read the artifact listing from a JSON file instead of calling the CLI",
    )
    parser.add_argument(
        "--require-previous",
        help="also require this wheel to still be present (the dual-wheel retention gate)",
    )
    parser.add_argument(
        "--previous-only",
        action="store_true",
        help=(
            "check only --require-previous, not the committed Terraform references. "
            "For cleanup after a failed deploy, where the new wheel legitimately may "
            "not exist yet and its absence must not mask the retention question."
        ),
    )
    args = parser.parse_args(argv)

    repo_root = pathlib.Path(__file__).resolve().parents[3]
    terraform_path = (
        pathlib.Path(args.terraform_file)
        if args.terraform_file
        else repo_root / f"infrastructure/env/{args.environment}/main.tf"
    )

    try:
        if not terraform_path.is_file() and not args.previous_only:
            print(f"No Terraform root at {terraform_path}; nothing to check.")
            return 0

        references = set() if args.previous_only else wheel_references(terraform_path.read_text())
        if not references and not args.previous_only:
            print(f"{terraform_path} references no wheels; nothing to check.")
            return 0

        directory = artifact_directory(args.environment)
        print(f"{args.environment}: Terraform references {sorted(references)}")
        print(f"{args.environment}: reading {directory}")

        if args.listing_file:
            listing = json.loads(pathlib.Path(args.listing_file).read_text())
        else:
            listing = list_workspace_directory(directory)
        uploaded = uploaded_wheels(listing)
        print(f"{args.environment}: uploaded {sorted(uploaded)}")

        missing = missing_wheels(references, uploaded)
        if missing:
            raise WheelArtifactError(
                f"{args.environment}: {sorted(missing)} referenced by Terraform but absent from "
                f"{directory}.\n\n{TWO_PHASE_POINTER}"
            )

        if args.require_previous and args.require_previous not in uploaded:
            raise WheelArtifactError(
                f"{args.environment}: {args.require_previous} is no longer in {directory}. "
                "Live resources still reference it until the full Terraform apply lands, so "
                "restore it from the snapshot before updating any pipeline, job or cluster."
            )
    except WheelArtifactError as error:
        print(f"WHEEL ARTIFACT CHECK FAILED: {error}", file=sys.stderr)
        return 1

    if args.previous_only:
        print(f"{args.environment}: {args.require_previous} is present.")
        return 0
    print(f"{args.environment}: every referenced wheel is present.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
