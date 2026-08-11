#!/usr/bin/env python3
"""Inventory the node service principal's account rule set before it is replaced.

`databricks_access_control_rule_set` is **authoritative** for the object it names:
applying it replaces the existing rule set of that type, so any grant made by hand
in the account console -- an operator, another automation principal -- disappears
silently. Terraform will report that as an ordinary update.

So the rule set is read and saved first, and anything Terraform does not declare is
fatal -- there is no acknowledgement flag, because "yes, drop those" is a decision
nobody can make correctly from a workflow input. The fix is to codify the grant.

`--require-etag` repeats the GET immediately before the apply and requires the live
etag to still equal the reviewed one, so an ACL changed between approval and apply
aborts instead of being overwritten.

    python scripts/inventory_run_as_acl.py \
      --account-id "$DATABRICKS_ACCOUNT_ID" \
      --node-application-id <node-sp-app-id> \
      --ci-application-id <github-ci-sp-app-id> \
      --output inventory.json

Exits non-zero when the live rule set carries any grant Terraform does not declare,
or when --require-etag no longer matches.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys

# The single grant infrastructure/env/{dev,prod}/main.tf manages.
MANAGED_ROLE = "roles/servicePrincipal.user"


class AclInventoryError(RuntimeError):
    """The live rule set cannot be replaced safely without a decision."""


def rule_set_name(account_id: str, node_application_id: str) -> str:
    for label, value in (("account id", account_id), ("application id", node_application_id)):
        if not re.fullmatch(r"[A-Za-z0-9-]{8,64}", value or ""):
            raise AclInventoryError(f"implausible {label}: {value!r}")
    return f"accounts/{account_id}/servicePrincipals/{node_application_id}/ruleSets/default"


def read_rule_set(name: str) -> dict:
    """Read the account rule set. A rule set that does not exist yet is empty."""
    completed = subprocess.run(
        # Exactly two positionals: NAME and ETAG. The command takes the etag as an
        # argument, not a flag, and an empty one means "the current state". Passing a
        # literal `etag` token made it three arguments, which Cobra rejects before
        # authentication -- so the read never happened at all.
        ["databricks", "account", "access-control", "get-rule-set", name, "", "--output", "json"],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        stderr = (completed.stderr or completed.stdout or "").strip()
        if "RESOURCE_DOES_NOT_EXIST" in stderr or "NOT_FOUND" in stderr:
            return {"name": name, "grant_rules": [], "etag": ""}
        raise AclInventoryError(f"could not read {name}: {stderr}")
    output = (completed.stdout or "").strip()
    return json.loads(output) if output else {"name": name, "grant_rules": [], "etag": ""}


def principal_names(rule: dict) -> list[str]:
    """The principals in a grant rule, whichever shape the API returned.

    The account access-control API documents principals as objects
    (``{"principal": "servicePrincipals/<id>"}``); older/other renderings use bare
    strings. Both are normalized to the ``<kind>/<id>`` string so classification
    does not depend on the rendering, and anything unrecognized is kept verbatim so
    it still shows up as unmanaged rather than being silently dropped.
    """
    normalized: list[str] = []
    for entry in rule.get("principals") or []:
        if isinstance(entry, str):
            normalized.append(entry)
        elif isinstance(entry, dict):
            value = entry.get("principal") or entry.get("name") or entry.get("value")
            normalized.append(value if isinstance(value, str) else json.dumps(entry, sort_keys=True))
        else:
            normalized.append(repr(entry))
    return normalized


def etag(rule_set: dict) -> str:
    """The read etag, to carry through the read/modify/write cycle."""
    value = rule_set.get("etag")
    return value if isinstance(value, str) else ""


def terraform_owned_grants(ci_application_id: str) -> list[dict]:
    """The complete grant set `databricks_access_control_rule_set` declares.

    One rule, one role, one principal -- see the resource in
    `infrastructure/env/{dev,prod}/main.tf`. If Terraform ever grows a second grant
    rule, it has to be added here too, and the test that reads the Terraform keeps
    the two honest.
    """
    return [{"role": MANAGED_ROLE, "principals": [f"servicePrincipals/{ci_application_id}"]}]


def normalized_grants(rule_set: dict) -> list[dict]:
    """Live grants as comparable records: roles kept, principals normalized+sorted."""
    grants = []
    for rule in rule_set.get("grant_rules") or []:
        grants.append({"role": rule.get("role"), "principals": sorted(principal_names(rule))})
    return sorted(grants, key=lambda grant: (str(grant["role"]), grant["principals"]))


def _flatten(grants: list[dict]) -> set[tuple[str, str]]:
    return {
        (str(grant.get("role")), principal) for grant in grants for principal in grant.get("principals") or []
    }


def grant_differences(rule_set: dict, ci_application_id: str) -> dict[str, list[str]]:
    """What the authoritative apply would add, and what it would silently remove.

    ``unexpected`` is the dangerous half: those grants exist live, Terraform does not
    declare them, and applying replaces the whole rule set -- so they disappear with
    no diff anyone would notice. ``missing`` is the change being rolled out (on a
    first bootstrap the rule set does not exist yet, so everything is missing), which
    is why only ``unexpected`` is fatal.
    """
    live = _flatten(normalized_grants(rule_set))
    expected = _flatten(terraform_owned_grants(ci_application_id))
    return {
        "unexpected": sorted(f"{role} -> {principal}" for role, principal in live - expected),
        "missing": sorted(f"{role} -> {principal}" for role, principal in expected - live),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account-id", required=True)
    parser.add_argument("--node-application-id", required=True)
    parser.add_argument("--ci-application-id", required=True)
    parser.add_argument("--output", help="write the live rule set here for the record")
    parser.add_argument(
        "--etag-output",
        help="write the read etag here, to bind the plan that follows to this inventory",
    )
    parser.add_argument("--rule-set-file", help="read the rule set from a file instead of the CLI")
    parser.add_argument(
        "--require-etag",
        help=(
            "re-read the live rule set and require this etag: the pre-apply concurrency "
            "gate against an account admin changing the ACL after it was reviewed"
        ),
    )
    args = parser.parse_args(argv)

    try:
        name = rule_set_name(args.account_id, args.node_application_id)
        print(f"Reading {name}")
        rule_set = (
            json.loads(pathlib.Path(args.rule_set_file).read_text())
            if args.rule_set_file
            else read_rule_set(name)
        )

        if args.output:
            pathlib.Path(args.output).write_text(json.dumps(rule_set, indent=2) + "\n")
            print(f"Saved the live rule set to {args.output}")

        # Databricks recommends carrying the read etag through the read/modify/write
        # cycle; here it also binds the reviewed inventory to the plan that follows.
        current_etag = etag(rule_set)
        if args.etag_output:
            pathlib.Path(args.etag_output).write_text((current_etag or "absent") + "\n")
        print(f"rule set etag: {current_etag or '(none: the rule set does not exist yet)'}")

        print(json.dumps(normalized_grants(rule_set), indent=2))

        if args.require_etag:
            # A fresh GET, compared against the etag the reviewed plan was bound to.
            # Without this, an ACL changed between approval and apply is overwritten
            # silently, because the apply-time check only re-reads its own job output.
            expected = args.require_etag.strip()
            actual = current_etag or "absent"
            if actual != expected:
                raise AclInventoryError(
                    f"the live rule set changed after it was reviewed: etag {actual!r}, "
                    f"reviewed {expected!r}. Someone modified the node service "
                    "principal's ACL since the inventory. Re-run the inventory, review "
                    "the new state, and re-approve before applying."
                )
            print("Live etag still matches the reviewed inventory.")

        differences = grant_differences(rule_set, args.ci_application_id)
        if differences["missing"]:
            print(f"the apply will add: {differences['missing']}")
        if differences["unexpected"]:
            raise AclInventoryError(
                "the live rule set carries grants Terraform does not declare, and the "
                "resource is authoritative, so applying it would silently remove them:\n"
                f"{json.dumps(differences['unexpected'], indent=2)}\n\n"
                "There is no acknowledgement flag for this. Add every grant that must "
                "survive to databricks_access_control_rule_set in "
                "infrastructure/env/<env>/main.tf, have that code change reviewed, and "
                "re-run the inventory."
            )
        print("The live rule set contains nothing Terraform does not own.")
    except AclInventoryError as error:
        print(f"ACL INVENTORY FAILED: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
