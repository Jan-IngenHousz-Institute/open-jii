"""The run-as authorization chain: Terraform grant, CI wiring, and the preflight.

Assigning `run_as.service_principal_name` requires the *deploying* identity to
hold the Service Principal User role on the principal it names. That is invisible
in the bundle and invisible to `bundle validate`, which is exactly why it is
asserted here: the deploy either has the codified grant and the preflight that
proves it, or the build fails.
"""

from __future__ import annotations

import importlib.util
import pathlib
import re

import pytest
import yaml

REPO_DATA = pathlib.Path(__file__).resolve().parents[2]
REPO_ROOT = REPO_DATA.parents[1]
PREFLIGHT = REPO_DATA / "scripts/preflight_dab_run_as.py"
WORKFLOW = REPO_ROOT / ".github/workflows/deploy-databricks.yml"
ENVIRONMENTS = ("dev", "prod")


def terraform(environment: str) -> str:
    return (REPO_ROOT / f"infrastructure/env/{environment}/main.tf").read_text()


@pytest.fixture(scope="module")
def preflight():
    spec = importlib.util.spec_from_file_location("preflight_dab_run_as", PREFLIGHT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestTerraformRunAsGrant:
    @pytest.mark.parametrize("environment", ENVIRONMENTS)
    def test_the_role_is_codified_for_each_environment(self, environment: str) -> None:
        source = terraform(environment)
        assert 'resource "databricks_access_control_rule_set" "node_service_principal_run_as"' in source
        # Account-level object, so it must use the account (mws) provider.
        block = source.split('resource "databricks_access_control_rule_set"')[1].split("\n}\n")[0]
        assert "provider = databricks.mws" in block
        assert 'role = "roles/servicePrincipal.user"' in block

    @pytest.mark.parametrize("environment", ENVIRONMENTS)
    def test_the_grant_names_the_two_real_principals(self, environment: str) -> None:
        block = (
            terraform(environment).split('resource "databricks_access_control_rule_set"')[1].split("\n}\n")[0]
        )
        # The rule set belongs to the node SP (the run_as target)...
        assert (
            "servicePrincipals/${module.node_service_principal.service_principal_application_id}"
            "/ruleSets/default" in block
        )
        # ...and grants the role to the CI SP (the deployer). Never the reverse:
        # making the CI principal the run identity would defeat the separation.
        assert (
            "servicePrincipals/${module.github_cicd_service_principal."
            'service_principal_application_id}"' in block
        )
        assert "var.databricks_account_id" in block

    @pytest.mark.parametrize("environment", ENVIRONMENTS)
    def test_only_the_user_role_is_granted(self, environment: str) -> None:
        # Least privilege: acting as the principal, not managing it.
        block = (
            terraform(environment).split('resource "databricks_access_control_rule_set"')[1].split("\n}\n")[0]
        )
        roles = re.findall(r'role\s*=\s*"([^"]+)"', block)
        assert roles == ["roles/servicePrincipal.user"]

    def test_dev_and_prod_grants_are_the_same_rule(self) -> None:
        blocks = [
            terraform(environment).split('resource "databricks_access_control_rule_set"')[1].split("\n}\n")[0]
            for environment in ENVIRONMENTS
        ]
        assert blocks[0] == blocks[1], "the two environments must not drift"


class TestWorkflowGate:
    @pytest.fixture(scope="class")
    def steps(self) -> list[dict]:
        workflow = yaml.safe_load(WORKFLOW.read_text())
        job = next(iter(workflow["jobs"].values()))
        return job["steps"]

    def test_the_preflight_runs_before_the_deploy(self, steps: list[dict]) -> None:
        names = [step.get("name", "") for step in steps]
        preflight = next(i for i, name in enumerate(names) if "Preflight run-as" in name)
        deploy = next(i for i, name in enumerate(names) if name == "Deploy bundle")
        assert preflight < deploy, "authorization must fail before anything is mutated"

    def test_the_preflight_proves_the_role(self, steps: list[dict]) -> None:
        step = next(step for step in steps if "Preflight run-as" in step.get("name", ""))
        assert "preflight_dab_run_as.py" in step["run"]
        # validate/plan alone cannot exercise servicePrincipal/user.
        assert "--prove-run-as" in step["run"]

    def test_the_preflight_uses_the_ci_credentials(self, steps: list[dict]) -> None:
        step = next(step for step in steps if "Preflight run-as" in step.get("name", ""))
        deploy = next(step for step in steps if step.get("name") == "Deploy bundle")
        assert step["env"] == deploy["env"], "it must authenticate as the real deployer"


class TestPreflightLogic:
    def test_missing_run_as_fails(self, preflight) -> None:
        summary = {"resources": {"jobs": {"j": {"tasks": []}}}}
        with pytest.raises(preflight.PreflightError, match="without a run_as"):
            preflight.run_as_principals(summary)

    def test_unresolved_lookup_fails(self, preflight) -> None:
        summary = {
            "resources": {
                "jobs": {"j": {"run_as": {"service_principal_name": "${var.node_service_principal}"}}}
            }
        }
        with pytest.raises(preflight.PreflightError, match="did not resolve"):
            preflight.run_as_principals(summary)

    def test_user_run_as_fails(self, preflight) -> None:
        summary = {"resources": {"jobs": {"j": {"run_as": {"user_name": "someone@jii.org"}}}}}
        with pytest.raises(preflight.PreflightError, match="user run_as"):
            preflight.run_as_principals(summary)

    def test_a_resolved_service_principal_passes(self, preflight) -> None:
        summary = {"resources": {"jobs": {"j": {"run_as": {"service_principal_name": "abc-123"}}}}}
        assert preflight.run_as_principals(summary) == {"j": "abc-123"}

    def test_no_jobs_fails(self, preflight) -> None:
        with pytest.raises(preflight.PreflightError, match="no jobs"):
            preflight.run_as_principals({"resources": {"jobs": {}}})

    def test_group_can_manage_fails(self, preflight) -> None:
        summary = {
            "resources": {"jobs": {"j": {"permissions": [{"group_name": "users", "level": "CAN_MANAGE"}]}}}
        }
        with pytest.raises(preflight.PreflightError, match="CAN_MANAGE"):
            preflight.check_resolved_jobs(summary, None)

    def test_a_boolean_switch_is_not_a_schema_input(self, preflight) -> None:
        # KEEP_SCHEMA=false is a retention switch; it cannot name a schema.
        assert not preflight.names_a_schema("KEEP_SCHEMA", "false")
        assert not preflight.names_a_schema("CENTRAL_SCHEMA", "centrum")
        assert preflight.names_a_schema("KEEP_SCHEMA", "centrum")
        assert preflight.names_a_schema("SMOKE_SCHEMA", "zz_v3_smoke_x")
        assert preflight.names_a_schema("TARGET_SCHEMA", "centrum")

    def test_a_schema_input_fails(self, preflight) -> None:
        summary = {
            "resources": {
                "jobs": {
                    "j": {
                        "tasks": [
                            {
                                "task_key": "smoke",
                                "notebook_task": {"base_parameters": {"SMOKE_SCHEMA": "centrum"}},
                            }
                        ]
                    }
                }
            }
        }
        with pytest.raises(preflight.PreflightError, match="names a schema"):
            preflight.check_resolved_jobs(summary, None)

    def test_the_central_schema_parameter_is_still_allowed(self, preflight) -> None:
        summary = {
            "resources": {
                "jobs": {
                    "j": {
                        "tasks": [
                            {
                                "task_key": "register",
                                "notebook_task": {"base_parameters": {"CENTRAL_SCHEMA": "centrum"}},
                            }
                        ]
                    }
                }
            }
        }
        assert preflight.check_resolved_jobs(summary, None) == []

    def test_a_stale_wheel_reference_fails(self, preflight) -> None:
        summary = {
            "resources": {
                "jobs": {
                    "j": {
                        "environments": [
                            {"spec": {"dependencies": ["/x/.internal/openjii-0.1.0-py3-none-any.whl"]}}
                        ]
                    }
                }
            }
        }
        with pytest.raises(preflight.PreflightError, match="stale"):
            preflight.check_resolved_jobs(summary, "0.2.0")

    def test_the_current_wheel_reference_passes(self, preflight) -> None:
        import openjii

        summary = {
            "resources": {
                "jobs": {
                    "j": {
                        "environments": [
                            {
                                "spec": {
                                    "dependencies": [
                                        f"/x/.internal/openjii-{openjii.__version__}-py3-none-any.whl"
                                    ]
                                }
                            }
                        ]
                    }
                }
            }
        }
        assert preflight.check_resolved_jobs(summary, openjii.__version__)

    def test_the_probe_job_is_disposable_and_inert(self) -> None:
        source = PREFLIGHT.read_text()
        # No tasks, no schedule, and deletion in `finally`: the probe exercises the
        # role and can leave nothing behind that could run.
        assert '"run_as": {"service_principal_name": principal}' in source
        assert "finally:" in source
        assert '"jobs", "delete"' in source
        assert "tasks" not in source.split("def prove_run_as")[1].split("def ")[0].replace("No tasks", "")

    def test_the_real_bundle_passes_the_static_checks(self, preflight) -> None:
        # The resolved summary is shaped like the bundle, so run the same assertions
        # over the committed configuration as a canary for accidental drift.
        import openjii

        bundle = yaml.safe_load((REPO_DATA / "databricks.yml").read_text())
        resolved = {
            "resources": {
                "jobs": {
                    name: {
                        **job,
                        "run_as": {"service_principal_name": "resolved-application-id"},
                        "environments": [
                            {
                                "spec": {
                                    "dependencies": [
                                        dependency.replace(
                                            "${workspace.artifact_path}", "/Workspace/x/artifacts"
                                        )
                                        for dependency in environment["spec"]["dependencies"]
                                    ]
                                }
                            }
                            for environment in job.get("environments", [])
                        ],
                    }
                    for name, job in bundle["resources"]["jobs"].items()
                }
            }
        }
        assert preflight.run_as_principals(resolved)
        preflight.check_resolved_jobs(resolved, openjii.__version__)
