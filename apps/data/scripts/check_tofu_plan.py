#!/usr/bin/env python3
"""Gate a saved OpenTofu plan on its JSON, not on formatted text.

`tofu show` output is for humans. Grepping it cannot tell an in-place update from a
replacement, and a `-target` plan can legitimately include the target's
dependencies -- so "no wheel filename in the text" says nothing about what the
apply will actually do.

This reads `tofu show -json` and enforces, per resource change:

  * the address is *exactly* one of a hard-coded set for the phase, and
  * every action is in that phase's allowed set,

with delete and replace refused unconditionally. A plan containing anything else
fails, and the offending addresses/actions are printed.

The same file also carries the binding metadata: which environment, commit,
workflow run and attempt produced it, the config digest, and the ACL inventory
etag it was reviewed against. `verify-binding` re-checks that before an apply
consumes the plan, so an artifact from another environment, commit or run cannot
be applied by mistake.

    python scripts/check_tofu_plan.py gate --plan-json acl.json --allow-set acl

    python scripts/check_tofu_plan.py bind --output binding.json --environment dev \
      --sha "$GITHUB_SHA" --run-id 42 --run-attempt 1 --config-digest abc --inventory-etag xyz

    python scripts/check_tofu_plan.py verify-binding --binding binding.json \
      --environment dev --sha "$GITHUB_SHA" --run-id 42 --run-attempt 1 \
      --config-digest abc --inventory-etag xyz
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

# Never allowed, whatever else is approved. A wheel rollout is an in-place update;
# destroying or recreating a cluster policy, job or pipeline is not part of it and
# must be reviewed by hand.
FORBIDDEN_ACTIONS = frozenset({"delete", "replace"})

# The exact resource addresses each phase may change, written out in full. Not
# patterns: a regex allowlist admitted `module.node_cluster_policy_evil.anything`
# through `module\.node_cluster_policy`, and a caller-supplied one could widen the
# gate to `.*` or inject shell syntax. Adding a resource here is a code change that
# gets reviewed like any other.
ACL_ADDRESS = "databricks_access_control_rule_set.node_service_principal_run_as"
CLUSTER_POLICY_ADDRESS = "module.node_cluster_policy.databricks_cluster_policy.this"
EXPORT_JOB_ADDRESS = "module.data_export_job.databricks_job.this"

# phase -> (addresses that may change, actions they may take, addresses that must change)
ALLOWED_SETS: dict[str, tuple[frozenset[str], frozenset[str], frozenset[str]]] = {
    # The bootstrap phase installs the run-as ACL and nothing else -- not even a
    # dependency of it.
    "acl": (
        frozenset({ACL_ADDRESS}),
        frozenset({"create", "update"}),
        frozenset({ACL_ADDRESS}),
    ),
    # Reconciliation moves the two OpenJII wheel references. The ACL is listed
    # because it is already applied and may legitimately show as a no-op or a
    # converging update; nothing else may change at all.
    "full": (
        frozenset({CLUSTER_POLICY_ADDRESS, EXPORT_JOB_ADDRESS, ACL_ADDRESS}),
        frozenset({"update"}),
        frozenset({CLUSTER_POLICY_ADDRESS, EXPORT_JOB_ADDRESS}),
    ),
}

# Always tolerated: a plan that changes nothing for a resource, and a data read.
NEUTRAL_ACTIONS = frozenset({"no-op", "read"})


class PlanGateError(RuntimeError):
    """The plan does something outside the approved set."""


def resource_changes(plan: dict) -> list[tuple[str, tuple[str, ...]]]:
    """(address, actions) for every resource change in a `tofu show -json` plan."""
    changes: list[tuple[str, tuple[str, ...]]] = []
    for entry in plan.get("resource_changes") or []:
        address = entry.get("address") or ""
        actions = tuple((entry.get("change") or {}).get("actions") or [])
        changes.append((address, actions))
    return changes


def is_replace(actions: tuple[str, ...]) -> bool:
    """Terraform encodes a replacement as a delete/create pair, in either order."""
    return "delete" in actions and "create" in actions


def violations(
    changes: list[tuple[str, tuple[str, ...]]],
    allowed_addresses: frozenset[str],
    allowed_actions: frozenset[str],
) -> list[str]:
    """Human-readable reasons the plan must not be applied.

    Address matching is exact string equality, so a near-prefix resource such as
    `module.node_cluster_policy_evil.thing` is not the allowed
    `module.node_cluster_policy.databricks_cluster_policy.this`.
    """
    problems: list[str] = []
    for address, actions in changes:
        action_set = set(actions)
        if action_set <= NEUTRAL_ACTIONS:
            continue
        if is_replace(actions):
            problems.append(f"{address}: replacement ({list(actions)})")
            continue
        forbidden = action_set & FORBIDDEN_ACTIONS
        if forbidden:
            problems.append(f"{address}: forbidden action {sorted(forbidden)}")
            continue
        if address not in allowed_addresses:
            problems.append(f"{address}: not an approved resource ({list(actions)})")
            continue
        disallowed = action_set - allowed_actions - NEUTRAL_ACTIONS
        if disallowed:
            problems.append(f"{address}: action {sorted(disallowed)} not approved")
    return problems


def missing_required(changes: list[tuple[str, tuple[str, ...]]], required: frozenset[str]) -> list[str]:
    """Required addresses the plan does not actually change."""
    changed = {address for address, actions in changes if not set(actions) <= NEUTRAL_ACTIONS}
    return sorted(required - changed)


def gate(arguments: argparse.Namespace) -> None:
    allowed_addresses, allowed_actions, required = ALLOWED_SETS[arguments.allow_set]
    plan = json.loads(pathlib.Path(arguments.plan_json).read_text())
    changes = resource_changes(plan)

    print(f"gate '{arguments.allow_set}' allows exactly:")
    for address in sorted(allowed_addresses):
        print(f"  {address}")
    print(f"{len(changes)} resource change(s) in the plan:")
    for address, actions in changes:
        print(f"  {list(actions)!s:28} {address}")

    problems = violations(changes, allowed_addresses, allowed_actions)
    if problems:
        raise PlanGateError(
            "the plan is not the approved change:\n  "
            + "\n  ".join(problems)
            + "\n\nNothing has been applied. Review the plan by hand; if another resource "
            "genuinely has to change, add its exact address to ALLOWED_SETS and have that "
            "code change reviewed."
        )

    absent = missing_required(changes, required)
    if absent:
        raise PlanGateError(
            f"the plan changes none of {absent}; it is not the change this phase exists to make"
        )
    print("Plan gate passed.")


def bind(arguments: argparse.Namespace) -> None:
    binding = {
        "environment": arguments.environment,
        "sha": arguments.sha,
        "run_id": str(arguments.run_id),
        "run_attempt": str(arguments.run_attempt),
        "config_digest": arguments.config_digest,
        "inventory_etag": arguments.inventory_etag,
        "plan_digest": arguments.plan_digest,
    }
    missing = [key for key, value in binding.items() if not value]
    if missing:
        raise PlanGateError(f"refusing to write a binding with empty {missing}")
    pathlib.Path(arguments.output).write_text(json.dumps(binding, indent=2, sort_keys=True) + "\n")
    print(json.dumps(binding, indent=2, sort_keys=True))


def verify_binding(arguments: argparse.Namespace) -> None:
    binding = json.loads(pathlib.Path(arguments.binding).read_text())
    expected = {
        "environment": arguments.environment,
        "sha": arguments.sha,
        "run_id": str(arguments.run_id),
        "run_attempt": str(arguments.run_attempt),
        "config_digest": arguments.config_digest,
        "inventory_etag": arguments.inventory_etag,
    }
    mismatched = {
        key: (binding.get(key), value)
        for key, value in expected.items()
        if value and binding.get(key) != value
    }
    if mismatched:
        raise PlanGateError(
            "the saved plan was not produced by this run/environment/commit:\n"
            + "\n".join(
                f"  {key}: artifact={got!r} expected={want!r}" for key, (got, want) in mismatched.items()
            )
        )
    if arguments.plan_digest and binding.get("plan_digest") != arguments.plan_digest:
        raise PlanGateError(
            f"plan digest mismatch: artifact={binding.get('plan_digest')!r} "
            f"actual={arguments.plan_digest!r}; the plan file changed after it was approved"
        )
    print("Plan binding verified.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    gate_parser = subparsers.add_parser("gate", help="enforce addresses and actions")
    gate_parser.add_argument("--plan-json", required=True)
    # A phase name, not an address list: there is deliberately no way for a caller
    # to name a resource or an action.
    gate_parser.add_argument("--allow-set", required=True, choices=sorted(ALLOWED_SETS))
    gate_parser.set_defaults(handler=gate)

    bind_parser = subparsers.add_parser("bind", help="write the plan's provenance")
    bind_parser.add_argument("--output", required=True)
    bind_parser.add_argument("--environment", required=True)
    bind_parser.add_argument("--sha", required=True)
    bind_parser.add_argument("--run-id", required=True)
    bind_parser.add_argument("--run-attempt", required=True)
    bind_parser.add_argument("--config-digest", required=True)
    bind_parser.add_argument("--inventory-etag", required=True)
    bind_parser.add_argument("--plan-digest", required=True)
    bind_parser.set_defaults(handler=bind)

    verify_parser = subparsers.add_parser("verify-binding", help="re-check it before applying")
    verify_parser.add_argument("--binding", required=True)
    verify_parser.add_argument("--environment", required=True)
    verify_parser.add_argument("--sha", required=True)
    verify_parser.add_argument("--run-id", required=True)
    verify_parser.add_argument("--run-attempt", required=True)
    verify_parser.add_argument("--config-digest", required=True)
    verify_parser.add_argument("--inventory-etag", required=True)
    verify_parser.add_argument("--plan-digest", default="")
    verify_parser.set_defaults(handler=verify_binding)

    arguments = parser.parse_args(argv)
    try:
        arguments.handler(arguments)
    except PlanGateError as error:
        print(f"PLAN GATE FAILED: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
