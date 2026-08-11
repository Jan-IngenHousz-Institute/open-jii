"""Static governance checks on the bundle and the two task notebooks.

The DDL job runs with a principal that can create and drop schemas across the
catalog, so who may run it, who may edit it, and what it is allowed to drop are
part of the contract -- not deployment trivia. These tests fail the build rather
than the workspace.
"""

from __future__ import annotations

import pathlib

import pytest
import yaml
from openjii.trace import scratch, sql_objects

REPO_DATA = pathlib.Path(__file__).resolve().parents[2]
BUNDLE = REPO_DATA / "databricks.yml"
REGISTER_TASK = REPO_DATA / "src/tasks/centrum_v3_sql_objects_task.py"
SMOKE_TASK = REPO_DATA / "src/tasks/centrum_v3_smoke_task.py"


@pytest.fixture(scope="module")
def bundle() -> dict:
    return yaml.safe_load(BUNDLE.read_text())


@pytest.fixture(scope="module")
def jobs(bundle: dict) -> dict:
    return bundle["resources"]["jobs"]


class TestRunIdentity:
    def test_every_job_declares_run_as(self, jobs: dict) -> None:
        # Without run_as the job inherits the deploying CI principal, which holds
        # none of the catalog grants the DDL needs.
        for name, job in jobs.items():
            assert "run_as" in job, f"{name} has no run_as identity"
            assert job["run_as"].get("service_principal_name"), name

    def test_run_as_is_the_node_service_principal(self, bundle: dict, jobs: dict) -> None:
        for job in jobs.values():
            assert job["run_as"]["service_principal_name"] == "${var.node_service_principal}"
        # Resolved by display name per target, never a checked-in application id.
        for target, config in bundle["targets"].items():
            lookup = config["variables"]["node_service_principal"]["lookup"]
            assert lookup["service_principal"] == f"node-service-principal-{target}"


class TestPermissions:
    def test_no_group_may_manage_the_ddl_job(self, bundle: dict, jobs: dict) -> None:
        # CAN_MANAGE allows editing a job's tasks and permissions, so it stays
        # with the deployment owner (implicit as creator).
        for permission in bundle.get("permissions", []):
            if permission.get("group_name"):
                assert permission["level"] != "CAN_MANAGE", permission
        for name, job in jobs.items():
            for permission in job.get("permissions", []):
                assert permission.get("level") != "CAN_MANAGE" or not permission.get("group_name"), (
                    f"{name} grants a group CAN_MANAGE"
                )

    def test_users_keep_read_access(self, bundle: dict) -> None:
        users = [p for p in bundle.get("permissions", []) if p.get("group_name") == "users"]
        assert users and users[0]["level"] == "CAN_VIEW"


class TestSmokeSchemaSafety:
    def test_the_bundle_passes_no_schema_to_the_smoke_task(self, jobs: dict) -> None:
        # A destructive schema name must not be reachable through job parameters.
        for job in jobs.values():
            for task in job["tasks"]:
                parameters = task.get("notebook_task", {}).get("base_parameters", {})
                assert "SMOKE_SCHEMA" not in parameters
                for key, value in parameters.items():
                    assert "centrum_v3_smoke" not in str(value), key

    def test_the_smoke_task_takes_no_schema_widget(self) -> None:
        source = SMOKE_TASK.read_text()
        assert 'widgets.text("SMOKE_SCHEMA"' not in source
        assert "new_scratch_schema" in source

    def test_the_smoke_task_only_drops_a_validated_generated_schema(self) -> None:
        source = SMOKE_TASK.read_text()
        drops = [line.strip() for line in source.splitlines() if "DROP SCHEMA" in line]
        assert len(drops) == 1, drops
        assert "{dropped}" in drops[0], "the dropped name must come from the guard"
        assert "assert_disposable(SMOKE_SCHEMA)" in source
        assert "\nfinally:" in source, "cleanup must run even when a check raises"

    def test_the_registration_task_drops_nothing(self) -> None:
        # The job that touches the real centrum schema is not allowed to delete.
        source = REGISTER_TASK.read_text()
        assert "DROP" not in source.upper()

    def test_the_guard_rejects_the_central_schema(self) -> None:
        for name in ("centrum", "centrum_v3_smoke", "default"):
            with pytest.raises(ValueError):
                scratch.assert_disposable(name)


class TestPackageIdentity:
    def test_the_wheel_dependency_matches_the_built_version(self, jobs: dict) -> None:
        # Serverless caches an environment per package version, so a changed
        # implementation under an unchanged version can serve stale code.
        import openjii

        expected = f"openjii-{openjii.__version__}-py3-none-any.whl"
        dependencies = [
            dependency
            for job in jobs.values()
            for environment in job.get("environments", [])
            for dependency in environment["spec"]["dependencies"]
        ]
        assert dependencies
        for dependency in dependencies:
            assert dependency.endswith(expected), dependency
            assert "${workspace.artifact_path}" in dependency

    def test_the_wheel_version_is_not_the_pre_v3_one(self) -> None:
        import openjii

        assert openjii.__version__ != "0.1.0"

    def test_pyproject_and_package_agree(self) -> None:
        import openjii

        pyproject = (REPO_DATA / "src/lib/openjii/pyproject.toml").read_text()
        assert f'version = "{openjii.__version__}"' in pyproject


class TestTasksAreDeployable:
    def test_notebook_paths_exist(self, jobs: dict) -> None:
        for job in jobs.values():
            for task in job["tasks"]:
                path = task["notebook_task"]["notebook_path"]
                assert (REPO_DATA / path.lstrip("./")).is_file(), path

    def test_registration_runs_before_the_smoke_test(self, jobs: dict) -> None:
        tasks = {t["task_key"]: t for t in jobs["centrum_v3_sql_objects"]["tasks"]}
        assert tasks["smoke"]["depends_on"] == [{"task_key": "register"}]

    def test_every_declared_object_is_registered_by_the_task(self) -> None:
        source = REGISTER_TASK.read_text()
        assert "sql_objects.statements" in source
        for view in sql_objects.VIEWS:
            # The task verifies each view resolves after creating it.
            assert "sql_objects.VIEWS" in source or view in source
