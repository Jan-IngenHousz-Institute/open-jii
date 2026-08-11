"""Whether the two-phase rollout can actually execute, and refuses when it should.

Fixup 03 got the phase order right but the jobs could not have initialized: missing
AWS action inputs, 24 missing Terraform variables, no target-environment binding,
text-grep plan gates, a caller-controlled outgoing wheel, and a production gate that
could not tell a dev run from a prod one. These tests are the executable half of the
answer -- the decision logic runs here, and the wiring that invokes it is compared
against the workflow the repository already trusts.
"""

from __future__ import annotations

import importlib.util
import json
import pathlib
import re
from typing import ClassVar

import pytest
import yaml

REPO_DATA = pathlib.Path(__file__).resolve().parents[2]
REPO_ROOT = REPO_DATA.parents[1]
ROLLOUT = REPO_ROOT / ".github/workflows/data-wheel-rollout.yml"
TOFU = REPO_ROOT / ".github/workflows/tofu.yml"
DEPLOY = REPO_ROOT / ".github/workflows/deploy.yml"
SETUP_ACTION = REPO_ROOT / ".github/actions/tofu/tofu-setup/action.yml"

ACL_ADDRESS = "databricks_access_control_rule_set.node_service_principal_run_as"
POLICY_ADDRESS = "module.node_cluster_policy.databricks_cluster_policy.this"
JOB_ADDRESS = "module.data_export_job.databricks_job.this"


def load(name: str):
    path = REPO_DATA / "scripts" / name
    spec = importlib.util.spec_from_file_location(path.stem, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def plan_gate():
    return load("check_tofu_plan.py")


@pytest.fixture(scope="module")
def live_refs():
    return load("live_wheel_refs.py")


@pytest.fixture(scope="module")
def attestation():
    return load("dev_attestation.py")


@pytest.fixture(scope="module")
def rollout() -> dict:
    return yaml.safe_load(ROLLOUT.read_text())


@pytest.fixture(scope="module")
def tofu() -> dict:
    return yaml.safe_load(TOFU.read_text())


def change(address: str, *actions: str) -> dict:
    return {"address": address, "change": {"actions": list(actions)}}


def parsed(module, *entries: dict) -> list[tuple[str, tuple[str, ...]]]:
    """Entries as the gate sees them: through `tofu show -json` parsing."""
    return module.resource_changes({"resource_changes": list(entries)})


def shell(job: dict, *, strip_comments: bool = False) -> str:
    """The job's shell verbatim (yaml.dump escapes quotes and rewraps lines)."""
    script = "\n".join(step.get("run", "") for step in job["steps"])
    if strip_comments:
        script = "\n".join(line for line in script.splitlines() if not line.strip().startswith("#"))
    return script


# --- executable Terraform wiring -------------------------------------------


class TestTerraformExecutability:
    TF_JOBS = ("acl-plan", "acl-apply", "full-plan", "full-apply")

    def test_required_action_inputs_are_supplied(self, rollout: dict) -> None:
        # The composite action requires aws_role_arn and aws_region; without them the
        # job cannot assume the role and never reaches a plan.
        action = yaml.safe_load(SETUP_ACTION.read_text())
        required = {name for name, spec in action["inputs"].items() if spec.get("required") is True}
        assert required == {"aws_role_arn", "aws_region"}
        for job in self.TF_JOBS:
            steps = rollout["jobs"][job]["steps"]
            setup = next(s for s in steps if str(s.get("uses", "")).endswith("tofu-setup"))
            assert required <= set(setup["with"]), f"{job} omits {required - set(setup['with'])}"
            assert "environment" not in setup["with"], f"{job} passes an input the action has no"

    def test_every_required_root_variable_is_provided(self, rollout: dict) -> None:
        # OpenTofu loads the whole root even for -target, so a missing required
        # variable stops the plan before it starts.
        for environment in ("dev", "prod"):
            text = (REPO_ROOT / f"infrastructure/env/{environment}/variables.tf").read_text()
            blocks = re.findall(r'variable\s+"([^"]+)"\s*\{(.*?)\n\}', text, re.S)
            required = {name for name, body in blocks if "default" not in body}
            for job in self.TF_JOBS:
                provided = {
                    key[len("TF_VAR_") :] for key in rollout["jobs"][job]["env"] if key.startswith("TF_VAR_")
                }
                missing = required - provided
                assert not missing, f"{job} omits {sorted(missing)} required by {environment}"

    def test_the_variable_set_matches_the_established_workflow(self, rollout: dict, tofu: dict) -> None:
        # Copied verbatim from tofu.yml, so the two cannot drift.
        proven = {k: v for k, v in tofu["jobs"]["plan"]["env"].items() if k.startswith("TF_VAR_")}
        for job in self.TF_JOBS:
            mine = {k: v for k, v in rollout["jobs"][job]["env"].items() if k.startswith("TF_VAR_")}
            assert mine == proven, f"{job} diverges from tofu.yml"

    def test_tofu_jobs_run_init_before_planning(self, rollout: dict) -> None:
        for job in self.TF_JOBS:
            names = [str(s.get("uses", "")) for s in rollout["jobs"][job]["steps"]]
            assert any(n.endswith("tofu-init-validate") for n in names), job


class TestCredentialBoundaries:
    def test_every_job_needing_secrets_binds_the_target_environment(self, rollout: dict) -> None:
        # Environment secrets are only available to jobs that reference that
        # environment; approval-gate is not a substitute for it.
        for name, job in rollout["jobs"].items():
            uses_secrets = "secrets." in yaml.dump(job)
            if not uses_secrets:
                continue
            assert job.get("environment") == "${{ inputs.environment }}", (
                f"{name} reads secrets without binding the target environment"
            )

    def test_approval_jobs_are_separate_and_hold_no_secrets(self, rollout: dict) -> None:
        for name in ("acl-approval", "full-approval"):
            job = rollout["jobs"][name]
            assert job["environment"] == "approval-gate"
            assert "secrets." not in yaml.dump(job), f"{name} should only gate, not act"

    def test_the_account_and_workspace_identities_stay_separate(self, rollout: dict) -> None:
        inventory = yaml.dump(rollout["jobs"]["acl-inventory"])
        assert "accounts.cloud.databricks.com" in inventory  # account host, not workspace
        assert "DATABRICKS_GHA_CLIENT_ID" not in inventory
        for job in ("bundle-plan", "bundle-deploy"):
            deployer = rollout["jobs"][job]["env"]
            assert "DATABRICKS_GHA_CLIENT_ID" in deployer["DATABRICKS_CLIENT_ID"], job

    def test_the_ordinary_guard_binds_the_environment_too(self) -> None:
        guard = yaml.safe_load(DEPLOY.read_text())["jobs"]["guard-data-wheel"]
        assert guard["environment"] == "${{ inputs.environment }}"


# --- JSON plan gates -------------------------------------------------------


class TestPlanGate:
    r"""The gate now compares addresses for exact equality against hard-coded sets.

    Fixup 04 matched caller-supplied regexes, so `module\.node_cluster_policy` also
    admitted `module.node_cluster_policy_evil.anything`, and the dispatch input could
    name any address at all.
    """

    ACL_ALLOWED: ClassVar[frozenset] = frozenset({ACL_ADDRESS})
    FULL_ALLOWED: ClassVar[frozenset] = frozenset({POLICY_ADDRESS, JOB_ADDRESS, ACL_ADDRESS})

    def test_the_intended_acl_change_passes(self, plan_gate) -> None:
        changes = parsed(plan_gate, change(ACL_ADDRESS, "create"))
        assert plan_gate.violations(changes, self.ACL_ALLOWED, {"create", "no-op"}) == []

    def test_a_dependency_change_without_a_wheel_string_is_refused(self, plan_gate) -> None:
        # Precisely what the text grep admitted: a -target plan may include the
        # target's dependencies, and none of them contain a wheel filename.
        changes = parsed(
            plan_gate,
            change(ACL_ADDRESS, "create"),
            change("module.node_service_principal.databricks_service_principal.this", "update"),
        )
        problems = plan_gate.violations(changes, self.ACL_ALLOWED, {"create", "update"})
        assert len(problems) == 1
        assert "databricks_service_principal" in problems[0]

    @pytest.mark.parametrize(
        "address",
        [
            "module.node_cluster_policy_evil.anything",
            "module.node_cluster_policy.databricks_cluster_policy.this.evil",
            "xmodule.node_cluster_policy.databricks_cluster_policy.this",
            " module.node_cluster_policy.databricks_cluster_policy.this",
            "module.node_cluster_policy.databricks_cluster_policy.this ",
            "module_node_cluster_policy.databricks_cluster_policy.this",
        ],
    )
    def test_a_near_miss_address_is_refused(self, plan_gate, address) -> None:
        # Every one of these matched the fixup-04 prefix regex or its escaped form.
        problems = plan_gate.violations(
            parsed(plan_gate, change(address, "update")), self.FULL_ALLOWED, {"update"}
        )
        assert problems, address

    def test_delete_and_replace_are_refused_even_if_allowed(self, plan_gate) -> None:
        for actions in (("delete",), ("delete", "create"), ("create", "delete")):
            problems = plan_gate.violations(
                parsed(plan_gate, change(POLICY_ADDRESS, *actions)),
                self.FULL_ALLOWED,
                {"create", "update", "delete"},
            )
            assert problems, actions

    def test_no_op_changes_are_ignored(self, plan_gate) -> None:
        assert (
            plan_gate.violations(parsed(plan_gate, change("anything.at.all", "no-op")), frozenset(), set())
            == []
        )

    def test_an_unrelated_create_is_refused_in_the_full_plan(self, plan_gate) -> None:
        changes = parsed(plan_gate, change(POLICY_ADDRESS, "update"), change("aws_s3_bucket.new", "create"))
        problems = plan_gate.violations(changes, self.FULL_ALLOWED, {"update"})
        assert any("aws_s3_bucket.new" in p for p in problems)

    def test_an_allowed_address_with_a_disallowed_action_is_refused(self, plan_gate) -> None:
        problems = plan_gate.violations(
            parsed(plan_gate, change(POLICY_ADDRESS, "create")), self.FULL_ALLOWED, {"update"}
        )
        assert any("not approved" in p for p in problems)

    def gate(self, plan_gate, tmp_path, allow_set: str, *entries: dict) -> int:
        plan = tmp_path / "plan.json"
        plan.write_text(json.dumps({"resource_changes": list(entries)}))
        return plan_gate.main(["gate", "--plan-json", str(plan), "--allow-set", allow_set])

    def test_the_gate_cli_fails_closed(self, plan_gate, tmp_path) -> None:
        assert self.gate(plan_gate, tmp_path, "acl", change("module.other.thing", "update")) == 1

    def test_the_acl_phase_passes_on_exactly_its_own_change(self, plan_gate, tmp_path) -> None:
        assert self.gate(plan_gate, tmp_path, "acl", change(ACL_ADDRESS, "create")) == 0

    def test_the_full_phase_needs_both_wheel_references_to_move(self, plan_gate, tmp_path) -> None:
        # Half a transition is the state this rollout exists to prevent: the cluster
        # policy on one wheel and the export job on another.
        assert self.gate(plan_gate, tmp_path, "full", change(POLICY_ADDRESS, "update")) == 1
        assert (
            self.gate(
                plan_gate,
                tmp_path,
                "full",
                change(POLICY_ADDRESS, "update"),
                change(JOB_ADDRESS, "update"),
            )
            == 0
        )

    def test_the_gate_requires_the_change_it_exists_to_make(self, plan_gate, tmp_path) -> None:
        # An empty plan is not success: the phase must actually move the ACL.
        assert self.gate(plan_gate, tmp_path, "acl") == 1
        assert self.gate(plan_gate, tmp_path, "full") == 1

    def test_the_gate_cannot_be_told_what_to_allow(self, plan_gate) -> None:
        source = (REPO_DATA / "scripts/check_tofu_plan.py").read_text()
        for flag in ("--allow-address", "--allow-actions", "--require-address"):
            assert flag not in source, f"{flag} would let the caller widen the gate"
        # And an unknown phase name is not a way in either: argparse rejects it
        # before any plan is read.
        with pytest.raises(SystemExit) as exit_code:
            plan_gate.main(["gate", "--plan-json", "/dev/null", "--allow-set", "anything"])
        assert exit_code.value.code == 2

    def test_the_approved_addresses_exist_in_the_terraform(self, plan_gate) -> None:
        # Hard-coded addresses are only safe while they are the real ones.
        policy = (REPO_ROOT / "infrastructure/modules/databricks/cluster-policy/main.tf").read_text()
        job = (REPO_ROOT / "infrastructure/modules/databricks/job/main.tf").read_text()
        assert 'resource "databricks_cluster_policy" "this"' in policy
        assert 'resource "databricks_job" "this"' in job
        for environment in ("dev", "prod"):
            root = (REPO_ROOT / f"infrastructure/env/{environment}/main.tf").read_text()
            assert 'module "node_cluster_policy"' in root, environment
            assert 'module "data_export_job"' in root, environment
            assert f'resource "databricks_access_control_rule_set" "{ACL_ADDRESS.split(".")[1]}"' in root


class TestPlanBinding:
    BINDING: ClassVar[dict] = {
        "environment": "dev",
        "sha": "a" * 40,
        "run_id": "42",
        "run_attempt": "1",
        "config_digest": "cfg",
        "inventory_etag": "etag",
        "plan_digest": "digest",
    }

    def write(self, tmp_path, **overrides) -> pathlib.Path:
        path = tmp_path / "binding.json"
        path.write_text(json.dumps({**self.BINDING, **overrides}))
        return path

    def arguments(self, path, **overrides) -> list[str]:
        values = {**self.BINDING, **overrides}
        return [
            "verify-binding",
            "--binding",
            str(path),
            "--environment",
            values["environment"],
            "--sha",
            values["sha"],
            "--run-id",
            values["run_id"],
            "--run-attempt",
            values["run_attempt"],
            "--config-digest",
            values["config_digest"],
            "--inventory-etag",
            values["inventory_etag"],
            "--plan-digest",
            values["plan_digest"],
        ]

    def test_the_matching_binding_verifies(self, plan_gate, tmp_path) -> None:
        assert plan_gate.main(self.arguments(self.write(tmp_path))) == 0

    @pytest.mark.parametrize(
        "field,value",
        [
            ("environment", "prod"),
            ("sha", "b" * 40),
            ("run_id", "43"),
            ("run_attempt", "2"),
            ("config_digest", "changed"),
            ("inventory_etag", "stale"),
            ("plan_digest", "tampered"),
        ],
    )
    def test_any_mismatch_refuses_the_apply(self, plan_gate, tmp_path, field, value) -> None:
        # A plan from another environment, commit, run, retry, config or ACL state
        # must not be applied, and neither must a plan file that changed after review.
        assert plan_gate.main(self.arguments(self.write(tmp_path), **{field: value})) == 1

    def test_binding_refuses_to_record_empty_provenance(self, plan_gate, tmp_path) -> None:
        assert (
            plan_gate.main(
                [
                    "bind",
                    "--output",
                    str(tmp_path / "b.json"),
                    "--environment",
                    "dev",
                    "--sha",
                    "",
                    "--run-id",
                    "1",
                    "--run-attempt",
                    "1",
                    "--config-digest",
                    "c",
                    "--inventory-etag",
                    "e",
                    "--plan-digest",
                    "d",
                ]
            )
            == 1
        )


# --- live wheel references -------------------------------------------------


class TestLiveWheelReferences:
    def test_the_outgoing_wheel_is_derived_from_both_resources(self, live_refs) -> None:
        assert (
            live_refs.agreed_wheel("openjii-0.1.0-py3-none-any.whl", "openjii-0.1.0-py3-none-any.whl")
            == "openjii-0.1.0-py3-none-any.whl"
        )

    def test_disagreeing_resources_stop_the_rollout(self, live_refs) -> None:
        with pytest.raises(live_refs.LiveRefError, match="disagree"):
            live_refs.agreed_wheel("openjii-0.1.0-py3-none-any.whl", "openjii-0.2.0-py3-none-any.whl")

    def test_an_arbitrary_present_wheel_cannot_pose_as_the_outgoing_one(self, live_refs) -> None:
        # The fixup-03 hole: claiming ambyte-0.1.0 satisfied the retention gate while
        # the real outgoing OpenJII wheel was already gone. Nothing here reads a
        # caller input, and a non-OpenJII filename is not even a candidate.
        assert live_refs.openjii_wheels('{"whl": "ambyte-0.1.0-py3-none-any.whl"}') == set()
        with pytest.raises(live_refs.LiveRefError, match="no OpenJII wheel"):
            live_refs.sole_wheel("the cluster policy", set())

    def test_two_openjii_wheels_in_one_resource_is_an_error(self, live_refs) -> None:
        with pytest.raises(live_refs.LiveRefError, match="more than one"):
            live_refs.sole_wheel(
                "the cluster policy",
                {"openjii-0.1.0-py3-none-any.whl", "openjii-0.2.0-py3-none-any.whl"},
            )

    def test_the_readback_requires_the_exact_new_wheel(self, live_refs, tmp_path) -> None:
        policy = tmp_path / "policy.json"
        job = tmp_path / "job.json"
        for path in (policy, job):
            path.write_text('{"definition": "openjii-0.1.0-py3-none-any.whl"}')
        arguments = ["--environment", "dev", "--policy-file", str(policy), "--job-file", str(job)]
        assert live_refs.main(arguments) == 0
        assert live_refs.main([*arguments, "--expect", "openjii-0.2.0-py3-none-any.whl"]) == 1
        assert live_refs.main([*arguments, "--expect", "openjii-0.1.0-py3-none-any.whl"]) == 0

    def test_a_stale_reference_in_one_resource_alone_fails(self, live_refs, tmp_path) -> None:
        policy = tmp_path / "policy.json"
        policy.write_text('{"definition": "openjii-0.2.0-py3-none-any.whl"}')
        job = tmp_path / "job.json"
        job.write_text('{"settings": {"libraries": [{"whl": "openjii-0.1.0-py3-none-any.whl"}]}}')
        assert (
            live_refs.main(
                [
                    "--environment",
                    "dev",
                    "--policy-file",
                    str(policy),
                    "--job-file",
                    str(job),
                    "--expect",
                    "openjii-0.2.0-py3-none-any.whl",
                ]
            )
            == 1
        )

    def test_transition_detection_points_at_the_two_phase_workflow(self, live_refs, tmp_path) -> None:
        policy = tmp_path / "policy.json"
        job = tmp_path / "job.json"
        for path in (policy, job):
            path.write_text('{"whl": "openjii-0.1.0-py3-none-any.whl"}')
        assert (
            live_refs.main(
                [
                    "--environment",
                    "dev",
                    "--policy-file",
                    str(policy),
                    "--job-file",
                    str(job),
                    "--expect-committed",
                    "0.2.0",
                    "--pointer",
                ]
            )
            == 1
        )
        assert "data-wheel-rollout.yml" in live_refs.TWO_PHASE_POINTER

    def test_no_transition_passes_quietly(self, live_refs, tmp_path) -> None:
        policy = tmp_path / "policy.json"
        job = tmp_path / "job.json"
        for path in (policy, job):
            path.write_text('{"whl": "openjii-0.2.0-py3-none-any.whl"}')
        assert (
            live_refs.main(
                [
                    "--environment",
                    "dev",
                    "--policy-file",
                    str(policy),
                    "--job-file",
                    str(job),
                    "--expect-committed",
                    "0.2.0",
                ]
            )
            == 0
        )


# --- dev attestation -------------------------------------------------------


class TestDevAttestation:
    COMPLETE: ClassVar[dict] = {
        "target": "dev",
        "sha": "c" * 40,
        "workflow_path": ".github/workflows/data-wheel-rollout.yml@refs/heads/main",
        "run_id": "100",
        "run_attempt": "1",
        "old_wheel": "openjii-0.1.0-py3-none-any.whl",
        "new_wheel": "openjii-0.2.0-py3-none-any.whl",
        "acl_plan_digest": "a" * 64,
        "full_plan_digest": "b" * 64,
        "policy_wheel": "openjii-0.2.0-py3-none-any.whl",
        "job_wheel": "openjii-0.2.0-py3-none-any.whl",
        "update_id": "31",
        "update_state": "COMPLETED",
        "full_refresh": "false",
        "smoke_run_id": "77",
        "smoke_state": "SUCCESS",
    }

    # What the Actions API says about the run that published it, read independently
    # of the artifact. Both sources have to agree.
    RUN: ClassVar[dict] = {
        "id": "100",
        "path": ".github/workflows/data-wheel-rollout.yml",
        "event": "workflow_dispatch",
        "conclusion": "success",
        "head_sha": "c" * 40,
        "run_attempt": "1",
    }

    def verify(self, attestation, run=None, dev_run_id=None, **overrides) -> None:
        record = attestation.build({**self.COMPLETE, **overrides})
        attestation.verify(
            record,
            self.COMPLETE["sha"],
            self.COMPLETE["new_wheel"],
            {**self.RUN, **(run or {})},
            dev_run_id or self.RUN["id"],
        )

    def test_a_complete_dev_rollout_verifies(self, attestation) -> None:
        self.verify(attestation)

    @pytest.mark.parametrize("field", sorted(set(COMPLETE) - {"full_refresh"}))
    def test_every_field_is_required(self, attestation, field) -> None:
        with pytest.raises(attestation.AttestationError, match=r"partial|missing"):
            attestation.build({**self.COMPLETE, field: ""})

    def test_a_prod_run_cannot_pose_as_the_dev_rollout(self, attestation) -> None:
        # gh run view cannot report workflow inputs, so this is the check that
        # distinguishes them.
        with pytest.raises(attestation.AttestationError, match=r"targeted 'prod'"):
            self.verify(attestation, target="prod")

    def test_another_commit_is_refused(self, attestation) -> None:
        with pytest.raises(attestation.AttestationError, match="not this commit"):
            self.verify(attestation, sha="d" * 40)

    def test_another_wheel_is_refused(self, attestation) -> None:
        with pytest.raises(attestation.AttestationError, match="rolled out"):
            self.verify(attestation, new_wheel="openjii-0.3.0-py3-none-any.whl")

    def test_a_no_op_rollout_is_refused(self, attestation) -> None:
        with pytest.raises(attestation.AttestationError, match="no wheel transition"):
            self.verify(attestation, old_wheel=self.COMPLETE["new_wheel"])

    @pytest.mark.parametrize("field", ["policy_wheel", "job_wheel"])
    def test_an_unproven_live_reference_is_refused(self, attestation, field) -> None:
        with pytest.raises(attestation.AttestationError, match="read back"):
            self.verify(attestation, **{field: "openjii-0.1.0-py3-none-any.whl"})

    @pytest.mark.parametrize("state", ["RUNNING", "FAILED", "CANCELED", "WAITING_FOR_RESOURCES"])
    def test_a_nonterminal_or_failed_update_is_refused(self, attestation, state) -> None:
        with pytest.raises(attestation.AttestationError, match="ended"):
            self.verify(attestation, update_state=state)

    def test_a_full_refresh_update_cannot_gate_production(self, attestation) -> None:
        with pytest.raises(attestation.AttestationError, match="full_refresh"):
            self.verify(attestation, full_refresh="true")

    @pytest.mark.parametrize(
        "state",
        [
            "FAILED",
            "TIMEDOUT",
            "CANCELED",
            "SKIPPED",
            "SUCCESS_WITH_FAILURES",
            # In neither pinned enum: the legacy result state and the current
            # termination code both spell success `SUCCESS`. Accepting a composite
            # nothing emits meant accepting a value somebody typed.
            "TERMINATED_SUCCESS",
            "terminated_success",
            "success",
        ],
    )
    def test_only_an_exact_success_smoke_opens_production(self, attestation, state) -> None:
        with pytest.raises(attestation.AttestationError, match="smoke"):
            self.verify(attestation, smoke_state=state)

    def test_the_attestation_allows_exactly_one_smoke_state(self, attestation) -> None:
        assert frozenset({"SUCCESS"}) == attestation.SMOKE_SUCCESS
        self.verify(attestation, smoke_state="SUCCESS")

    def test_an_unknown_schema_is_refused(self, attestation) -> None:
        record = attestation.build(self.COMPLETE)
        record["schema"] = "something.else/1"
        with pytest.raises(attestation.AttestationError, match="schema"):
            attestation.verify(
                record, self.COMPLETE["sha"], self.COMPLETE["new_wheel"], self.RUN, self.RUN["id"]
            )

    def test_a_missing_attestation_file_fails_closed(self, attestation, tmp_path) -> None:
        assert attestation.main(["verify", *self.verify_arguments(tmp_path / "absent.json")]) == 1

    def verify_arguments(self, path, **overrides) -> list[str]:
        run = {**self.RUN, **overrides}
        return [
            "--attestation",
            str(path),
            "--sha",
            overrides.get("sha", self.COMPLETE["sha"]),
            "--new-wheel",
            self.COMPLETE["new_wheel"],
            "--dev-run-id",
            overrides.get("dev_run_id", run["id"]),
            "--run-id",
            run["id"],
            "--run-path",
            run["path"],
            "--run-event",
            run["event"],
            "--run-conclusion",
            run["conclusion"],
            "--run-head-sha",
            run["head_sha"],
            "--run-attempt",
            run["run_attempt"],
        ]

    def test_the_cli_round_trips(self, attestation, tmp_path) -> None:
        path = tmp_path / "attestation.json"
        arguments = ["write", "--output", str(path)]
        for key, value in self.COMPLETE.items():
            arguments += [f"--{key.replace('_', '-')}", value]
        assert attestation.main(arguments) == 0
        assert attestation.main(["verify", *self.verify_arguments(path)]) == 0
        # The same file, offered against a run that is not the one that made it.
        assert attestation.main(["verify", *self.verify_arguments(path, id="999", dev_run_id="999")]) == 1


# --- workflow structure ----------------------------------------------------


class TestRolloutStructure:
    def test_no_caller_supplied_outgoing_wheel_input(self, rollout: dict) -> None:
        triggers = rollout[True] if True in rollout else rollout["on"]
        assert "previous_wheel" not in triggers["workflow_dispatch"]["inputs"]

    def test_approval_follows_plan_generation(self, rollout: dict) -> None:
        # The approval reviews a saved artifact, so it cannot precede it.
        assert rollout["jobs"]["acl-approval"]["needs"] == ["acl-plan"]
        assert rollout["jobs"]["full-approval"]["needs"] == ["full-plan"]
        assert "acl-approval" in rollout["jobs"]["acl-apply"]["needs"]
        assert "full-approval" in rollout["jobs"]["full-apply"]["needs"]

    def test_apply_consumes_the_uploaded_artifact(self, rollout: dict) -> None:
        for job, plan in (("acl-apply", "t5-runas-bootstrap"), ("full-apply", "t5-full")):
            steps = yaml.dump(rollout["jobs"][job])
            assert "download-artifact" in steps, job
            assert "verify-binding" in steps, job
            assert f"tofu apply -no-color {plan}.tfplan" in steps, job
            assert "-auto-approve" not in steps, job

    def test_artifact_names_are_bound_to_environment_run_and_attempt(self, rollout: dict) -> None:
        for name in (
            "ACL_PLAN_ARTIFACT",
            "BUNDLE_PLAN_ARTIFACT",
            "WHEEL_BACKUP_ARTIFACT",
            "FULL_PLAN_ARTIFACT",
            "INVENTORY_ARTIFACT",
        ):
            value = rollout["env"][name]
            for binding in ("inputs.environment", "github.run_id", "github.run_attempt"):
                assert binding in value, f"{name} is not bound to {binding}"

    def test_the_inventory_cannot_be_acknowledged_away(self, rollout: dict) -> None:
        # Fixup 04 let a dispatch checkbox authorize dropping every grant Terraform
        # does not declare. There is no such flag now, anywhere.
        text = ROLLOUT.read_text()
        triggers = rollout[True] if True in rollout else rollout["on"]
        assert "acl_reconciled" not in triggers["workflow_dispatch"]["inputs"]
        assert "acl_reconciled" not in text
        assert "acknowledge-extra-grants" not in text
        assert "--acknowledge-extra-grants" not in (REPO_DATA / "scripts/inventory_run_as_acl.py").read_text()
        assert "--etag-output" in shell(rollout["jobs"]["acl-inventory"])

    def test_the_apply_rereads_the_live_acl_before_touching_it(self, rollout: dict) -> None:
        # A human sits between the plan and the apply; this resource is
        # authoritative; so the reviewed etag has to still be live at apply time.
        steps = rollout["jobs"]["acl-apply"]["steps"]
        names = [s.get("name", "") for s in steps]
        fresh = next(i for i, n in enumerate(names) if "Fresh live GET" in n)
        apply = next(i for i, n in enumerate(names) if "Apply that exact plan" in n)
        assert fresh < apply
        step = steps[fresh]
        assert "inventory_run_as_acl.py" in step["run"]
        assert "--require-etag" in step["run"]
        assert step["env"]["DATABRICKS_HOST"] == "https://accounts.cloud.databricks.com"

    def test_the_inventory_binds_its_etag_into_the_plan(self, rollout: dict) -> None:
        assert "--etag-output" in shell(rollout["jobs"]["acl-inventory"])
        for job in ("acl-plan", "acl-apply", "full-plan", "full-apply"):
            assert "inventory_etag" in yaml.dump(rollout["jobs"][job]), job

    def test_exactly_one_service_principal_of_each_kind_is_required(self, rollout: dict) -> None:
        inventory = shell(rollout["jobs"]["acl-inventory"])
        assert "grep -c ." in inventory, "two principals sharing a display name is ambiguous"

    def test_the_bundle_plan_is_approved_before_the_deploy_runs(self, rollout: dict) -> None:
        # The bundle deploy is a mutation like any other, so its plan is recorded,
        # bound, approved, and re-verified -- not printed into a log and forgotten.
        assert rollout["jobs"]["bundle-approval"]["needs"] == ["bundle-plan"]
        assert rollout["jobs"]["bundle-approval"]["environment"] == "approval-gate"
        assert "bundle-approval" in rollout["jobs"]["bundle-deploy"]["needs"]
        plan = shell(rollout["jobs"]["bundle-plan"])
        assert "bundle plan -t" in plan and "--output json" in plan
        assert "check_tofu_plan.py bind" in plan
        deploy = yaml.dump(rollout["jobs"]["bundle-deploy"])
        assert "download-artifact" in deploy
        assert "verify-binding" in deploy

    def test_the_deploy_phase_proves_the_role_then_deploys(self, rollout: dict) -> None:
        names = [s.get("name", "") for s in rollout["jobs"]["bundle-deploy"]["steps"]]
        verify = next(i for i, n in enumerate(names) if "Re-verify the approved bundle plan" in n)
        probe = next(i for i, n in enumerate(names) if "Preflight run-as" in n)
        deploy = next(i for i, n in enumerate(names) if n == "Deploy the bundle")
        proof = next(i for i, n in enumerate(names) if "Dual-wheel proof" in n)
        assert verify < probe < deploy < proof

    def test_the_outgoing_wheel_is_backed_up_before_the_deploy(self, rollout: dict) -> None:
        planning = [s.get("name", "") for s in rollout["jobs"]["bundle-plan"]["steps"]]
        backup = next(i for i, n in enumerate(planning) if "Back up the outgoing wheel" in n)
        upload = next(i for i, n in enumerate(planning) if "Upload the outgoing-wheel backup" in n)
        assert backup < upload
        # And the deploy job, a separate machine, downloads it before deploying.
        deploying = [s.get("name", "") for s in rollout["jobs"]["bundle-deploy"]["steps"]]
        download = next(i for i, n in enumerate(deploying) if "Download the outgoing-wheel backup" in n)
        deploy = next(i for i, n in enumerate(deploying) if n == "Deploy the bundle")
        assert download < deploy

    def test_a_pruned_wheel_is_restored_and_proven_on_every_outcome(self, rollout: dict) -> None:
        restore = next(
            s
            for s in rollout["jobs"]["bundle-deploy"]["steps"]
            if "restore the outgoing wheel" in s.get("name", "").lower()
        )
        # always(), not failure(): a deploy that succeeded while retention pruned the
        # outgoing wheel is just as broken, and nothing else would notice.
        assert "always()" in str(restore["if"])
        assert "failure()" not in str(restore["if"])
        assert "workspace import" in restore["run"]
        assert "--previous-only" in restore["run"]
        assert "check_wheel_artifacts.py" in restore["run"]
        # Every branch that is not "intact and the job succeeded" exits non-zero;
        # test_rollout_hardening.py runs the script to prove it.
        assert '[ "$JOB_STATUS" != "success" ]' in restore["run"]
        assert restore["run"].count("exit 1") >= 4

    def test_operators_are_told_not_to_hard_cancel_the_deploy(self) -> None:
        header = ROLLOUT.read_text().split("name: Data wheel rollout")[0]
        assert "DO NOT HARD-CANCEL" in header
        assert "cleanup" in header

    def test_the_pipeline_update_is_explicit_and_polled(self, rollout: dict) -> None:
        code = shell(rollout["jobs"]["pipeline-update"], strip_comments=True)
        # There is no --no-full-refresh flag on any pinned CLI; the request body
        # carries it, so the value is stated rather than defaulted.
        assert "--no-full-refresh" not in code
        assert "--json '{\"full_refresh\": false}'" in code
        # Started is not finished: prod must not open while dev is still running.
        assert "get-update" in code
        assert "COMPLETED" in code
        assert "FAILED|CANCELED|CANCELLED" in code

    def test_the_attestation_is_dev_only_and_needs_every_phase(self, rollout: dict) -> None:
        attest = rollout["jobs"]["attest"]
        assert "inputs.environment == 'dev'" in str(attest["if"])
        for phase in ("acl-plan", "bundle-plan", "full-plan", "full-apply", "pipeline-update", "smoke"):
            assert phase in attest["needs"], phase

    def test_prod_validates_the_attestation_artifact(self, rollout: dict) -> None:
        step = next(
            s for s in rollout["jobs"]["preconditions"]["steps"] if "dev attestation" in s.get("name", "")
        )
        assert "inputs.environment == 'prod'" in str(step["if"])
        assert "gh run download" in step["run"]
        assert "dev_attestation.py verify" in step["run"]
        # Data reaches the shell through env, so the commit is checked via HEAD_SHA.
        assert step["env"]["HEAD_SHA"] == "${{ github.sha }}"
        assert '--sha "$HEAD_SHA"' in step["run"]
        # And the run itself is interrogated, not just the artifact it carries.
        assert "actions/runs/$DEV_RUN_ID" in step["run"]
        for flag in ("--run-path", "--run-event", "--run-conclusion", "--run-head-sha", "--run-attempt"):
            assert flag in step["run"], flag

    def test_the_smoke_phase_runs_the_registration_job(self, rollout: dict) -> None:
        # Started through the Jobs command that returns a run id, not `bundle run`,
        # which emits none on the pinned CLI. See test_rollout_hardening.py.
        script = shell(rollout["jobs"]["smoke"])
        assert "--job-key centrum_v3_sql_objects" in script
        assert "smoke_job_run.py" in script

    def test_first_activation_is_documented_in_the_workflow(self) -> None:
        header = ROLLOUT.read_text().split("name: Data wheel rollout")[0]
        assert "default branch" in header
        assert "workflow_dispatch" in header

    def test_no_trigger_was_added_to_demonstrate_it(self, rollout: dict) -> None:
        triggers = rollout[True] if True in rollout else rollout["on"]
        assert set(triggers) == {"workflow_dispatch"}
