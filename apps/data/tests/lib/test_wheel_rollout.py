"""The two-phase wheel rollout, and the guard that stops the unsafe order.

The hazard is an ordering one, so most of it lives in workflow YAML rather than in
Python. These tests simulate the decisions that YAML delegates -- which wheels are
referenced, which are uploaded, what that means for an apply -- and assert the
wiring that decides when those decisions are consulted.
"""

from __future__ import annotations

import importlib.util
import json
import pathlib
import subprocess
import sys

import pytest
import yaml

REPO_DATA = pathlib.Path(__file__).resolve().parents[2]
REPO_ROOT = REPO_DATA.parents[1]
DEPLOY = REPO_ROOT / ".github/workflows/deploy.yml"
ROLLOUT = REPO_ROOT / ".github/workflows/data-wheel-rollout.yml"
CHECK_SCRIPT = REPO_DATA / "scripts/check_wheel_artifacts.py"
INVENTORY_SCRIPT = REPO_DATA / "scripts/inventory_run_as_acl.py"
PREFLIGHT_SCRIPT = REPO_DATA / "scripts/preflight_dab_run_as.py"


def load(path: pathlib.Path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def checker():
    return load(CHECK_SCRIPT)


@pytest.fixture(scope="module")
def inventory():
    return load(INVENTORY_SCRIPT)


@pytest.fixture(scope="module")
def preflight():
    return load(PREFLIGHT_SCRIPT)


@pytest.fixture(scope="module")
def deploy_jobs() -> dict:
    return yaml.safe_load(DEPLOY.read_text())["jobs"]


@pytest.fixture(scope="module")
def rollout() -> dict:
    return yaml.safe_load(ROLLOUT.read_text())


class TestWheelReferenceDetection:
    def test_reads_every_wheel_the_real_terraform_names(self, checker) -> None:
        for environment in ("dev", "prod"):
            text = (REPO_ROOT / f"infrastructure/env/{environment}/main.tf").read_text()
            references = checker.wheel_references(text)
            # The committed change bumped openjii; the other three are untouched.
            assert "openjii-0.2.0-py3-none-any.whl" in references, environment
            assert "openjii-0.1.0-py3-none-any.whl" not in references, environment
            assert any(name.startswith("ambyte-") for name in references), environment

    def test_environments_without_wheel_references_are_not_checked(self, checker) -> None:
        assert checker.wheel_references('resource "aws_s3_bucket" "b" {}') == set()

    def test_a_transition_is_blocked_until_the_upload_happened(self, checker) -> None:
        referenced = {"openjii-0.2.0-py3-none-any.whl"}
        before_upload = checker.uploaded_wheels([{"path": "/x/.internal/openjii-0.1.0-py3-none-any.whl"}])
        assert checker.missing_wheels(referenced, before_upload) == referenced

        after_upload = checker.uploaded_wheels(
            [
                {"path": "/x/.internal/openjii-0.1.0-py3-none-any.whl"},
                {"path": "/x/.internal/openjii-0.2.0-py3-none-any.whl"},
            ]
        )
        assert checker.missing_wheels(referenced, after_upload) == set()

    def test_listing_entries_may_be_paths_or_names(self, checker) -> None:
        assert checker.uploaded_wheels(["/a/b/openjii-0.2.0-py3-none-any.whl"]) == {
            "openjii-0.2.0-py3-none-any.whl"
        }
        assert checker.uploaded_wheels([{"name": "openjii-0.2.0-py3-none-any.whl"}]) == {
            "openjii-0.2.0-py3-none-any.whl"
        }
        assert checker.uploaded_wheels([{"path": "/a/notebook"}]) == set()


class TestEnvironmentIsolation:
    def test_each_environment_reads_its_own_artifact_directory(self, checker) -> None:
        dev = checker.artifact_directory("dev")
        prod = checker.artifact_directory("prod")
        assert dev != prod
        assert dev.endswith("/dev/artifacts/.internal")
        assert prod.endswith("/prod/artifacts/.internal")

    def test_a_dev_upload_cannot_satisfy_a_prod_reference(self, checker, tmp_path) -> None:
        # Same wheel name, but the prod check reads the prod directory, which in
        # this simulation is still empty.
        dev_listing = tmp_path / "dev.json"
        dev_listing.write_text(json.dumps([{"path": "/x/dev/.internal/openjii-0.2.0-py3-none-any.whl"}]))
        prod_listing = tmp_path / "prod.json"
        prod_listing.write_text(json.dumps([]))

        terraform = tmp_path / "main.tf"
        terraform.write_text('whl = ".internal/openjii-0.2.0-py3-none-any.whl"')

        assert (
            checker.main(
                [
                    "--environment",
                    "dev",
                    "--terraform-file",
                    str(terraform),
                    "--listing-file",
                    str(dev_listing),
                ]
            )
            == 0
        )
        assert (
            checker.main(
                [
                    "--environment",
                    "prod",
                    "--terraform-file",
                    str(terraform),
                    "--listing-file",
                    str(prod_listing),
                ]
            )
            == 1
        )

    def test_refuses_an_implausible_environment_name(self, checker) -> None:
        with pytest.raises(checker.WheelArtifactError):
            checker.artifact_directory("../../etc")


class TestDualWheelRetention:
    def test_the_outgoing_wheel_must_survive_the_upload(self, checker, tmp_path) -> None:
        terraform = tmp_path / "main.tf"
        terraform.write_text('whl = "openjii-0.2.0-py3-none-any.whl"')
        listing = tmp_path / "listing.json"
        listing.write_text(json.dumps([{"path": "/x/openjii-0.2.0-py3-none-any.whl"}]))
        arguments = [
            "--environment",
            "dev",
            "--terraform-file",
            str(terraform),
            "--listing-file",
            str(listing),
        ]
        # New wheel alone: fine for the reference check...
        assert checker.main(arguments) == 0
        # ...but the retention gate fails, because live Terraform still names 0.1.0.
        assert checker.main([*arguments, "--require-previous", "openjii-0.1.0-py3-none-any.whl"]) == 1

        listing.write_text(
            json.dumps(
                [
                    {"path": "/x/openjii-0.2.0-py3-none-any.whl"},
                    {"path": "/x/openjii-0.1.0-py3-none-any.whl"},
                ]
            )
        )
        assert checker.main([*arguments, "--require-previous", "openjii-0.1.0-py3-none-any.whl"]) == 0

    def test_a_missing_terraform_root_is_not_an_error(self, checker, tmp_path) -> None:
        assert (
            checker.main(["--environment", "sandbox", "--terraform-file", str(tmp_path / "absent.tf")]) == 0
        )


class TestOrdinaryWorkflowGuard:
    def test_the_guard_detects_the_transition_itself(self, deploy_jobs: dict) -> None:
        # Not a path filter and not a directory listing: the version this commit
        # builds, against what the two live resources actually reference.
        guard = deploy_jobs["guard-data-wheel"]
        script = "\n".join(step.get("run", "") for step in guard["steps"])
        assert "live_wheel_refs.py" in script
        assert "--expect-committed" in script
        assert "--pointer" in script
        assert "pyproject.toml" in script

    def test_the_guard_covers_every_route_that_could_move_a_wheel(self, deploy_jobs: dict) -> None:
        # A superset of both dependents' triggers, so "guard skipped" can never
        # coexist with "a gated job ran". The data-app route closes the data-only
        # bundle deploy, which can prune the artifact a live reference names.
        guard = " ".join(str(deploy_jobs["guard-data-wheel"]["if"]).split())
        for route in (
            "inputs.deploy_infrastructure",
            "needs.detect.outputs.infra_changed == 'true'",
            "inputs.deploy_all",
            "contains(inputs.deploy_app, 'databricks')",
            "contains(fromJSON(needs.detect.outputs.affected_apps), 'data')",
        ):
            assert route in guard, route

    def test_the_infrastructure_apply_requires_the_guard_to_have_passed(self, deploy_jobs: dict) -> None:
        job = deploy_jobs["deploy-infrastructure"]
        assert "guard-data-wheel" in job["needs"]
        condition = " ".join(str(job["if"]).split())
        # Strict equality: neither a skip nor a failure may let the apply through.
        assert "needs.guard-data-wheel.result == 'success'" in condition
        assert "contains('success,skipped', needs.guard-data-wheel.result)" not in condition

    def test_neither_input_route_bypasses_the_guard(self, deploy_jobs: dict) -> None:
        condition = " ".join(str(deploy_jobs["deploy-infrastructure"]["if"]).split())
        # Both trigger routes are inside the parenthesised clause that is ANDed
        # with the guard result, so neither can satisfy the job on its own.
        assert condition.startswith(
            "(inputs.deploy_infrastructure || needs.detect.outputs.infra_changed == 'true') &&"
        )

    def test_the_databricks_deploy_requires_the_guard_to_have_passed(self, deploy_jobs: dict) -> None:
        # Strict now: the guard also runs for data-only deploys, which can prune an
        # artifact a live reference still names, so "skipped" is not acceptable here.
        job = deploy_jobs["deploy-databricks"]
        assert "guard-data-wheel" in job["needs"]
        condition = " ".join(str(job["if"]).split())
        assert "needs.guard-data-wheel.result == 'success'" in condition
        assert "contains('success,skipped', needs.guard-data-wheel.result)" not in condition

    def test_non_wheel_deployments_keep_their_wiring(self, deploy_jobs: dict) -> None:
        # The guard gates the infrastructure apply and the Databricks deploy only.
        for name in ("deploy-backend", "deploy-frontend", "deploy-docs", "database-migrations"):
            assert "guard-data-wheel" not in deploy_jobs[name]["needs"], name
        # And the established ordering is untouched.
        assert deploy_jobs["deploy-backend"]["needs"][:2] == ["deploy-infrastructure", "database-migrations"]

    def test_the_guard_failure_message_points_at_the_two_phase_workflow(self, checker) -> None:
        assert "data-wheel-rollout.yml" in checker.TWO_PHASE_POINTER
        assert "two-phase" in checker.TWO_PHASE_POINTER.lower()


class TestTwoPhaseWorkflow:
    def test_it_is_manual_only(self, rollout: dict) -> None:
        triggers = rollout[True] if True in rollout else rollout["on"]
        assert set(triggers) == {"workflow_dispatch"}, "an automatic trigger would defeat the point"

    def test_phase_order(self, rollout: dict) -> None:
        jobs = rollout["jobs"]
        assert jobs["acl-inventory"]["needs"] == ["preconditions"]
        assert jobs["acl-plan"]["needs"] == ["preconditions", "acl-inventory"]
        assert jobs["acl-approval"]["needs"] == ["acl-plan"]
        assert "acl-approval" in jobs["acl-apply"]["needs"]
        assert jobs["bundle-plan"]["needs"] == ["preconditions", "acl-inventory", "acl-apply"]
        assert jobs["bundle-approval"]["needs"] == ["bundle-plan"]
        assert "bundle-approval" in jobs["bundle-deploy"]["needs"]
        assert "bundle-deploy" in jobs["full-plan"]["needs"]
        assert jobs["full-approval"]["needs"] == ["full-plan"]
        assert "full-approval" in jobs["full-apply"]["needs"]
        assert jobs["pipeline-update"]["needs"] == ["preconditions", "full-apply"]
        assert jobs["smoke"]["needs"] == ["preconditions", "pipeline-update"]

    def test_the_targeted_phase_targets_only_the_acl(self, rollout: dict) -> None:
        plan = "\n".join(step.get("run", "") for step in rollout["jobs"]["acl-plan"]["steps"])
        apply = "\n".join(step.get("run", "") for step in rollout["jobs"]["acl-apply"]["steps"])
        assert "-target=databricks_access_control_rule_set.node_service_principal_run_as" in plan
        assert "-out=t5-runas-bootstrap.tfplan" in plan
        # The gate is the plan JSON, not a text grep for a wheel filename.
        assert "tofu show -json" in plan
        assert 'check_tofu_plan.py" gate' in plan
        # Applies the saved, approved plan; never a fresh auto-approved one.
        assert "tofu apply -no-color t5-runas-bootstrap.tfplan" in apply
        assert "-auto-approve" not in plan + apply

    def test_the_upload_phase_proves_the_role_then_deploys(self, rollout: dict) -> None:
        steps = [step.get("name", "") for step in rollout["jobs"]["bundle-deploy"]["steps"]]
        probe = next(i for i, name in enumerate(steps) if "Preflight run-as" in name)
        deploy = next(i for i, name in enumerate(steps) if name == "Deploy the bundle")
        dual = next(i for i, name in enumerate(steps) if "Dual-wheel proof" in name)
        assert probe < deploy < dual

    def test_the_upload_phase_uses_the_ci_deployer_credentials(self, rollout: dict) -> None:
        for job in ("bundle-plan", "bundle-deploy"):
            env = rollout["jobs"][job]["env"]
            assert "DATABRICKS_GHA_CLIENT_ID" in env["DATABRICKS_CLIENT_ID"], job

    def test_the_acl_phases_use_the_account_credentials(self, rollout: dict) -> None:
        inventory_env = rollout["jobs"]["acl-inventory"]["steps"][-2]["env"]
        assert inventory_env["DATABRICKS_HOST"] == "https://accounts.cloud.databricks.com"
        assert "DATABRICKS_ACCOUNT_ID" in inventory_env["DATABRICKS_ACCOUNT_ID"]

    def test_terraform_reconciliation_reproves_the_upload_first(self, rollout: dict) -> None:
        planning = [step.get("name", "") for step in rollout["jobs"]["full-plan"]["steps"]]
        reprove = next(i for i, name in enumerate(planning) if "Re-prove" in name)
        plan = next(i for i, name in enumerate(planning) if name.startswith("Full plan"))
        assert reprove < plan
        applying = [step.get("name", "") for step in rollout["jobs"]["full-apply"]["steps"]]
        verify = next(i for i, name in enumerate(applying) if "Re-verify the artifact" in name)
        apply = next(i for i, name in enumerate(applying) if "Apply that exact plan" in name)
        readback = next(i for i, name in enumerate(applying) if "Read both live references" in name)
        assert verify < apply < readback

    def test_the_full_plan_rejects_destruction(self, rollout: dict) -> None:
        # From the plan JSON now: delete and replace are refused by the gate itself,
        # so the workflow no longer has to enumerate English phrases.
        plan = "\n".join(step.get("run", "") for step in rollout["jobs"]["full-plan"]["steps"])
        apply = "\n".join(step.get("run", "") for step in rollout["jobs"]["full-apply"]["steps"])
        assert "tofu show -json" in plan
        assert 'check_tofu_plan.py" gate' in plan
        # The approved addresses and actions are in the gate, selected by phase.
        assert "--allow-set full" in plan
        assert "--allow-address" not in plan
        assert "tofu apply -no-color t5-full.tfplan" in apply

    def test_the_pipeline_update_is_never_a_full_refresh(self, rollout: dict) -> None:
        script = "\n".join(step.get("run", "") for step in rollout["jobs"]["pipeline-update"]["steps"])
        # No such flag exists on the pinned CLI; the request body states the value.
        code = "\n".join(line for line in script.splitlines() if not line.strip().startswith("#"))
        assert "--no-full-refresh" not in code
        assert "--json '{\"full_refresh\": false}'" in code

    def test_mutating_phases_sit_behind_an_approval(self, rollout: dict) -> None:
        # The approval is its own job now, so the applying job can bind the target
        # environment for its credentials while still requiring the approval.
        for applier, approval in (("acl-apply", "acl-approval"), ("full-apply", "full-approval")):
            assert rollout["jobs"][approval]["environment"] == "approval-gate", approval
            assert approval in rollout["jobs"][applier]["needs"], applier

    def test_prod_requires_a_verified_dev_attestation(self, rollout: dict) -> None:
        # Run metadata is not enough: gh cannot report workflow inputs, so a prod run
        # of the same commit would otherwise pass as the dev rollout.
        steps = rollout["jobs"]["preconditions"]["steps"]
        step = next(s for s in steps if "dev attestation" in s.get("name", ""))
        assert "inputs.environment == 'prod'" in str(step["if"])
        assert "DEV_RUN_ID" in step["run"]
        assert "gh run download" in step["run"]
        assert "dev_attestation.py verify" in step["run"]
        # The commit reaches the shell as an environment variable, quoted.
        assert step["env"]["HEAD_SHA"] == "${{ github.sha }}"
        assert '--sha "$HEAD_SHA"' in step["run"], "the attestation must be for this commit"

    def test_only_preconditions_may_read_the_actions_api(self, rollout: dict) -> None:
        # `gh run view` needs actions: read to verify the prod dev_run_id. Nothing
        # else in this workflow reads the Actions API, and the token it would widen
        # is the same one every other job holds, so the scope stays on one job.
        assert "actions" not in (rollout.get("permissions") or {}), (
            "the workflow-wide default must not grant actions access"
        )
        preconditions = rollout["jobs"]["preconditions"]["permissions"]
        assert preconditions == {"contents": "read", "actions": "read"}
        for name, job in rollout["jobs"].items():
            if name == "preconditions":
                continue
            assert "actions" not in (job.get("permissions") or {}), name

    def test_the_job_that_needs_actions_read_is_the_one_calling_gh(self, rollout: dict) -> None:
        # Keeps the grant tied to its reason: if the gh call moves, this fails.
        callers = {
            name
            for name, job in rollout["jobs"].items()
            if any(
                "gh api" in step.get("run", "") or "gh run download" in step.get("run", "")
                for step in job["steps"]
            )
        }
        assert callers == {"preconditions"}

    def test_the_only_dispatch_inputs_are_the_environment_and_the_dev_run(self, rollout: dict) -> None:
        # Every other input was a way for the caller to widen what the run may do.
        triggers = rollout[True] if True in rollout else rollout["on"]
        assert set(triggers["workflow_dispatch"]["inputs"]) == {"environment", "dev_run_id"}
        assert triggers["workflow_dispatch"]["inputs"]["environment"]["type"] == "choice"


class TestAclInventory:
    """The live rule set has to equal the complete Terraform-owned grant set.

    The resource is authoritative: whatever the apply does not declare, it removes.
    So "unexpected" is fatal and there is no flag to wave it through; "missing" is
    just the change being rolled out.
    """

    def test_an_unmanaged_role_would_be_dropped(self, inventory) -> None:
        rule_set = {
            "grant_rules": [{"role": "roles/servicePrincipal.manager", "principals": ["users/ops@jii.org"]}]
        }
        differences = inventory.grant_differences(rule_set, "ci-app-id")
        assert differences["unexpected"] == ["roles/servicePrincipal.manager -> users/ops@jii.org"]

    def test_an_extra_principal_on_the_managed_role_would_be_dropped(self, inventory) -> None:
        rule_set = {
            "grant_rules": [
                {
                    "role": "roles/servicePrincipal.user",
                    "principals": ["servicePrincipals/ci-app-id", "servicePrincipals/other"],
                }
            ]
        }
        differences = inventory.grant_differences(rule_set, "ci-app-id")
        assert differences["unexpected"] == ["roles/servicePrincipal.user -> servicePrincipals/other"]
        assert differences["missing"] == []

    def test_exactly_the_managed_grant_is_clean(self, inventory) -> None:
        rule_set = {
            "grant_rules": [
                {"role": "roles/servicePrincipal.user", "principals": ["servicePrincipals/ci-app-id"]}
            ]
        }
        assert inventory.grant_differences(rule_set, "ci-app-id") == {"unexpected": [], "missing": []}

    def test_an_absent_rule_set_only_reports_the_grant_being_added(self, inventory) -> None:
        # First bootstrap: nothing exists yet, so everything is "missing" and nothing
        # is at risk of being dropped.
        differences = inventory.grant_differences({}, "ci-app-id")
        assert differences["unexpected"] == []
        assert differences["missing"] == ["roles/servicePrincipal.user -> servicePrincipals/ci-app-id"]

    def test_the_declared_set_matches_the_terraform(self, inventory) -> None:
        # The comparison is only correct while it mirrors the resource.
        for environment in ("dev", "prod"):
            terraform = (REPO_ROOT / f"infrastructure/env/{environment}/main.tf").read_text()
            block = terraform.split('resource "databricks_access_control_rule_set"')[1]
            block = block[: block.index("\n}")]
            assert block.count("grant_rules") == 1, environment
            assert inventory.MANAGED_ROLE in block, environment
        assert inventory.terraform_owned_grants("ci-app-id") == [
            {"role": inventory.MANAGED_ROLE, "principals": ["servicePrincipals/ci-app-id"]}
        ]

    def test_it_refuses_by_default_and_saves_the_inventory(self, inventory, tmp_path) -> None:
        rule_set = tmp_path / "live.json"
        rule_set.write_text(
            json.dumps(
                {"grant_rules": [{"role": "roles/servicePrincipal.manager", "principals": ["users/a"]}]}
            )
        )
        saved = tmp_path / "saved.json"
        arguments = [
            "--account-id",
            "1234abcd-5678-90ef-1234-567890abcdef",
            "--node-application-id",
            "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            "--ci-application-id",
            "11111111-2222-3333-4444-555555555555",
            "--rule-set-file",
            str(rule_set),
            "--output",
            str(saved),
        ]
        assert inventory.main(arguments) == 1
        assert json.loads(saved.read_text())["grant_rules"], "the live state is recorded either way"
        # There is no way to accept it from the outside; the grant has to be codified.
        source = INVENTORY_SCRIPT.read_text()
        assert "--acknowledge-extra-grants" not in source
        assert "acknowledge" not in source.split('"""')[2]

    def test_the_rule_set_name_matches_the_terraform(self, inventory) -> None:
        name = inventory.rule_set_name("acct-1234-5678", "node-app-9012-3456")
        assert name == "accounts/acct-1234-5678/servicePrincipals/node-app-9012-3456/ruleSets/default"
        terraform = (REPO_ROOT / "infrastructure/env/dev/main.tf").read_text()
        assert "/ruleSets/default" in terraform

    def test_it_refuses_implausible_ids(self, inventory) -> None:
        with pytest.raises(inventory.AclInventoryError):
            inventory.rule_set_name("../etc", "node")


class TestFailClosedWheelVersion:
    def test_it_reads_the_committed_pyproject(self, preflight) -> None:
        import openjii

        assert preflight.expected_wheel_version() == openjii.__version__

    def test_an_explicit_value_wins(self, preflight) -> None:
        assert preflight.expected_wheel_version("9.9.9") == "9.9.9"

    def test_an_implausible_explicit_value_is_refused(self, preflight) -> None:
        with pytest.raises(preflight.PreflightError):
            preflight.expected_wheel_version("../../etc/passwd")

    def test_it_fails_closed_when_the_version_cannot_be_determined(self, preflight, tmp_path) -> None:
        # Never silently skip the check: that is what made the old import-based
        # lookup a no-op in CI.
        with pytest.raises(preflight.PreflightError, match="cannot determine"):
            preflight.expected_wheel_version(None, tmp_path / "absent.toml")

        empty = tmp_path / "pyproject.toml"
        empty.write_text("[project]\nname = 'openjii'\n")
        with pytest.raises(preflight.PreflightError, match="cannot determine"):
            preflight.expected_wheel_version(None, empty)

    def test_it_resolves_in_a_clean_interpreter_without_the_package(self) -> None:
        # Reproduces CI, which installs pip and build but not this package. The
        # unit tests above run inside the uv workspace, where openjii *is*
        # importable, so this is the case that used to go unnoticed.
        probe = (
            "import importlib.util, sys;"
            "spec = importlib.util.spec_from_file_location('p', sys.argv[1]);"
            "m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m);"
            "assert importlib.util.find_spec('openjii') is None, 'openjii must not be importable';"
            "print(m.expected_wheel_version())"
        )
        completed = subprocess.run(
            [sys.executable, "-S", "-c", probe, str(PREFLIGHT_SCRIPT)],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT),
            env={"PATH": "/usr/bin:/bin", "PYTHONNOUSERSITE": "1"},
            check=False,
        )
        if "openjii must not be importable" in completed.stderr:
            pytest.skip("this interpreter can import openjii; cannot simulate clean CI here")
        assert completed.returncode == 0, completed.stderr
        pyproject = (REPO_DATA / "src/lib/openjii/pyproject.toml").read_text()
        version = next(line.split('"')[1] for line in pyproject.splitlines() if line.startswith("version = "))
        assert completed.stdout.strip() == version

    def test_the_cli_accepts_an_explicit_version(self, preflight) -> None:
        parser_source = PREFLIGHT_SCRIPT.read_text()
        assert '"--wheel-version"' in parser_source
        assert "expected_wheel_version(args.wheel_version)" in parser_source

    def test_the_rollout_workflow_passes_the_version_explicitly(self, rollout: dict) -> None:
        for job in ("bundle-plan", "bundle-deploy"):
            script = "\n".join(step.get("run", "") for step in rollout["jobs"][job]["steps"])
            assert '--wheel-version "$WHEEL_VERSION"' in script, job
            environments = [step.get("env") or {} for step in rollout["jobs"][job]["steps"]]
            assert any(
                env.get("WHEEL_VERSION") == "${{ needs.preconditions.outputs.wheel_version }}"
                for env in environments
            ), job
