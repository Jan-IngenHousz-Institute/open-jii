"""The rollout under attack: injection, races, synthesized provenance, lost wheels.

Fixup 04 was structurally right and still had five ways to be wrong about reality:
a dispatch input spliced into shell source, an ACL acknowledgement checkbox, a smoke
phase that defaulted to SUCCESS when it could not read a run id, a bundle deploy with
no approved plan, and cleanup that only ran on `failure()`.

These tests execute the workflow's own shell -- extracted from the YAML, run under
`bash -e` as Actions runs it, with stub `databricks`/`python`/`gh` on PATH -- so the
claims are about what the script does, not about what it looks like.
"""

from __future__ import annotations

import importlib.util
import inspect
import json
import os
import pathlib
import re
import shutil
import subprocess
from typing import ClassVar

import pytest
import yaml

REPO_DATA = pathlib.Path(__file__).resolve().parents[2]
REPO_ROOT = REPO_DATA.parents[1]
ROLLOUT = REPO_ROOT / ".github/workflows/data-wheel-rollout.yml"

# A marker any successful injection would leave behind.
PWNED = "pwned"


def load(name: str):
    path = REPO_DATA / "scripts" / name
    spec = importlib.util.spec_from_file_location(path.stem, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def rollout() -> dict:
    return yaml.safe_load(ROLLOUT.read_text())


@pytest.fixture(scope="module")
def inventory():
    return load("inventory_run_as_acl.py")


@pytest.fixture(scope="module")
def preflight():
    return load("preflight_dab_run_as.py")


def step_script(rollout: dict, job: str, name_fragment: str) -> str:
    """One step's `run` text, verbatim from the workflow."""
    step = next(
        s
        for s in rollout["jobs"][job]["steps"]
        if name_fragment.lower() in s.get("name", "").lower() and "run" in s
    )
    return step["run"]


class Sandbox:
    """A directory with stub executables on PATH, to run a workflow step in."""

    def __init__(self, root: pathlib.Path) -> None:
        self.root = root
        self.bin = root / "bin"
        self.bin.mkdir(parents=True, exist_ok=True)
        self.log = root / "calls.log"

    def stub(self, name: str, body: str) -> None:
        path = self.bin / name
        path.write_text(f'#!/usr/bin/env bash\necho "{name} $*" >> {self.log}\n{body}\n')
        path.chmod(0o755)

    def calls(self) -> list[str]:
        return self.log.read_text().splitlines() if self.log.is_file() else []

    def run(self, script: str, **env: str) -> subprocess.CompletedProcess:
        path = self.root / "step.sh"
        path.write_text(script)
        # -e, as Actions invokes `run` on Linux.
        return subprocess.run(
            ["bash", "-e", str(path)],
            capture_output=True,
            text=True,
            cwd=str(self.root),
            env={
                "PATH": f"{self.bin}:/usr/bin:/bin",
                "GITHUB_OUTPUT": str(self.root / "output.txt"),
                "GITHUB_REPOSITORY": "jan-ingenhousz-institute/open-jii",
                "GITHUB_WORKSPACE": str(self.root),
                "WHEEL_BACKUP_ARTIFACT": "wheel-backup-artifact",
                **env,
            },
            check=False,
        )

    def outputs(self) -> dict[str, str]:
        path = self.root / "output.txt"
        if not path.is_file():
            return {}
        return dict(line.split("=", 1) for line in path.read_text().splitlines() if "=" in line)


@pytest.fixture
def sandbox(tmp_path) -> Sandbox:
    return Sandbox(tmp_path)


# --- no caller-controlled shell --------------------------------------------


class TestNoInjectableShell:
    def test_no_step_interpolates_anything_into_its_script(self, rollout: dict) -> None:
        # The general invariant, cheap to check and impossible to regress silently:
        # `${{ }}` expands *into the shell source* before bash sees it, so a value
        # containing `$(...)` runs. Data reaches these scripts through env only.
        offenders = [
            (job, step.get("name"), line.strip())
            for job, spec in rollout["jobs"].items()
            for step in spec.get("steps", [])
            for line in (step.get("run") or "").splitlines()
            if "${{" in line
        ]
        assert offenders == []

    def test_every_needs_reference_is_declared(self, rollout: dict) -> None:
        # An undeclared `needs.<job>.outputs.x` is not an error at parse time: it
        # expands to the empty string, and the failure surfaces as a mystery further
        # down. This found bundle-plan reading the ACL etag it had not declared,
        # which would have bound the bundle plan to nothing.
        unresolved = [
            (job, referenced)
            for job, spec in rollout["jobs"].items()
            for referenced in sorted(set(re.findall(r"needs\.([A-Za-z0-9_-]+)\.", yaml.dump(spec))))
            if referenced not in set(spec.get("needs") or [])
        ]
        assert unresolved == []

    def test_the_dispatch_surface_carries_no_addresses_or_flags(self, rollout: dict) -> None:
        triggers = rollout[True] if True in rollout else rollout["on"]
        inputs = triggers["workflow_dispatch"]["inputs"]
        assert set(inputs) == {"environment", "dev_run_id"}
        text = ROLLOUT.read_text()
        for gone in ("extra_plan_address", "acl_reconciled", "previous_wheel", "--allow-address"):
            assert gone not in text, gone

    def test_a_hostile_dev_run_id_is_refused_and_never_executed(self, rollout: dict, sandbox) -> None:
        # The fixup-04 shape of this bug: a string input reaching shell source. Here
        # the value is an env var *and* validated, so both layers are exercised.
        sandbox.stub("gh", "exit 0")
        sandbox.stub("python", "exit 0")
        sandbox.stub("jq", "echo ''")
        script = step_script(rollout, "preconditions", "dev attestation")
        hostile = f"$(touch {sandbox.root / PWNED})"
        result = sandbox.run(script, DEV_RUN_ID=hostile, HEAD_SHA="a" * 40, NEW_WHEEL="w.whl")
        assert result.returncode == 1
        assert "numeric" in result.stdout + result.stderr
        assert not (sandbox.root / PWNED).exists(), "the input was evaluated as shell"
        assert sandbox.calls() == [], "nothing should have been invoked at all"

    def test_a_hostile_environment_value_stays_one_literal_argument(self, rollout: dict, sandbox) -> None:
        # The wheel-derivation step, run with an environment name that would break out
        # if it were interpolated. It must arrive as a single argv element.
        sandbox.stub(
            "python",
            f'printf "%s\\n" "$@" > {sandbox.root}/argv.txt\n'
            "echo openjii-0.1.0-py3-none-any.whl > outgoing-wheel.txt",
        )
        script = step_script(rollout, "bundle-plan", "Derive the outgoing wheel")
        hostile = f'dev"; touch {sandbox.root / PWNED}; echo "'
        result = sandbox.run(script, TARGET_ENV=hostile, NEW_WHEEL="openjii-0.2.0-py3-none-any.whl")
        assert result.returncode == 0, result.stderr
        assert not (sandbox.root / PWNED).exists()
        argv = (sandbox.root / "argv.txt").read_text().splitlines()
        assert hostile in argv, argv
        assert sum(1 for a in argv if PWNED in a) == 1, "the value was split by the shell"


# --- the ACL etag race -----------------------------------------------------


class TestAclEtagRace:
    IDS: ClassVar[list[str]] = [
        "--account-id",
        "1234abcd-5678-90ef-1234-567890abcdef",
        "--node-application-id",
        "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "--ci-application-id",
        "11111111-2222-3333-4444-555555555555",
    ]
    CI_PRINCIPAL = "servicePrincipals/11111111-2222-3333-4444-555555555555"

    def rule_set(self, tmp_path, etag: str, extra: list | None = None) -> pathlib.Path:
        path = tmp_path / f"rule-set-{etag}.json"
        path.write_text(
            json.dumps(
                {
                    "grant_rules": [
                        {
                            "role": "roles/servicePrincipal.user",
                            "principals": [{"principal": self.CI_PRINCIPAL}],
                        },
                        *(extra or []),
                    ],
                    "etag": etag,
                }
            )
        )
        return path

    def test_the_reviewed_etag_still_live_passes(self, inventory, tmp_path) -> None:
        path = self.rule_set(tmp_path, "ETAG-1")
        assert inventory.main([*self.IDS, "--rule-set-file", str(path), "--require-etag", "ETAG-1"]) == 0

    def test_an_acl_changed_after_the_review_stops_the_apply(self, inventory, tmp_path, capsys) -> None:
        # Someone with account-admin rights adds a grant between phase 2 and phase 4.
        # The reviewed plan would delete it, and this is the only thing that notices.
        path = self.rule_set(tmp_path, "ETAG-2")
        assert inventory.main([*self.IDS, "--rule-set-file", str(path), "--require-etag", "ETAG-1"]) == 1
        assert "changed after it was reviewed" in capsys.readouterr().err

    def test_a_vanished_rule_set_is_a_change_too(self, inventory, tmp_path) -> None:
        path = tmp_path / "empty.json"
        path.write_text("{}")
        assert inventory.main([*self.IDS, "--rule-set-file", str(path), "--require-etag", "ETAG-1"]) == 1

    def test_an_uncodified_grant_is_refused_even_with_the_right_etag(
        self, inventory, tmp_path, capsys
    ) -> None:
        path = self.rule_set(
            tmp_path,
            "ETAG-1",
            extra=[{"role": "roles/servicePrincipal.manager", "principals": ["users/ops@jii.org"]}],
        )
        assert inventory.main([*self.IDS, "--rule-set-file", str(path), "--require-etag", "ETAG-1"]) == 1
        error = capsys.readouterr().err
        assert "Terraform does not declare" in error
        assert "servicePrincipal.manager" in error

    def test_both_workflow_reads_go_to_the_live_api(self, rollout: dict) -> None:
        # `--rule-set-file` exists for these tests. If either phase used it, the
        # command whose argv the contract test pins would never run in a real rollout
        # -- which is exactly how a three-positional call survived four reviews.
        for job, fragment in (
            ("acl-inventory", "Read the node service principal rule set"),
            ("acl-apply", "Fresh live GET"),
        ):
            script = step_script(rollout, job, fragment)
            assert "inventory_run_as_acl.py" in script, job
            assert "--rule-set-file" not in script, job

    def test_the_official_principal_object_shape_is_understood(self, inventory, tmp_path) -> None:
        # The API returns {"principal": "..."} objects; a parser that only handled
        # bare strings would report the managed grant as missing and a foreign one as
        # absent, i.e. it would pass while being blind.
        path = self.rule_set(tmp_path, "ETAG-1")
        rule_set = json.loads(path.read_text())
        assert inventory.principal_names(rule_set["grant_rules"][0]) == [self.CI_PRINCIPAL]


# --- pinned CLI contracts --------------------------------------------------


class TestPinnedAclArgv:
    """`account access-control get-rule-set` takes exactly NAME and ETAG.

    Every other ACL test supplies `--rule-set-file`, which is precisely why a
    malformed live command survived four rounds: the code path that talks to the CLI
    was never executed. This one executes it, against a recording stub and -- when a
    real CLI is installed -- against the real argument parser.
    """

    NAME = "accounts/1234abcd-5678-90ef-1234-567890abcdef/servicePrincipals/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/ruleSets/default"

    def recorded_argv(self, tmp_path, response: str = '{"grant_rules": [], "etag": "E1"}') -> list[str]:
        binary = tmp_path / "bin"
        binary.mkdir()
        recording = tmp_path / "argv.json"
        (binary / "databricks").write_text(
            "#!/usr/bin/env python3\n"
            "import json, sys\n"
            f"open({str(recording)!r}, 'w').write(json.dumps(sys.argv[1:]))\n"
            f"print({response!r})\n"
        )
        (binary / "databricks").chmod(0o755)
        module = load("inventory_run_as_acl.py")
        original = os.environ["PATH"]
        os.environ["PATH"] = f"{binary}:{original}"
        try:
            module.read_rule_set(self.NAME)
        finally:
            os.environ["PATH"] = original
        return json.loads(recording.read_text())

    def test_the_live_read_passes_exactly_two_positionals(self, tmp_path) -> None:
        argv = self.recorded_argv(tmp_path)
        assert argv == [
            "account",
            "access-control",
            "get-rule-set",
            self.NAME,
            "",
            "--output",
            "json",
        ]
        positionals = argv[3 : next(i for i, a in enumerate(argv) if a.startswith("--"))]
        assert len(positionals) == 2, positionals
        assert "etag" not in argv, "a literal `etag` token would be a third positional"

    def test_the_read_returns_the_parsed_rule_set(self, tmp_path) -> None:
        module = load("inventory_run_as_acl.py")
        binary = tmp_path / "bin"
        binary.mkdir()
        (binary / "databricks").write_text(
            '#!/usr/bin/env bash\necho \'{"grant_rules": [], "etag": "E7"}\'\n'
        )
        (binary / "databricks").chmod(0o755)
        original = os.environ["PATH"]
        os.environ["PATH"] = f"{binary}:{original}"
        try:
            assert module.etag(module.read_rule_set(self.NAME)) == "E7"
        finally:
            os.environ["PATH"] = original

    @pytest.mark.skipif(shutil.which("databricks") is None, reason="no Databricks CLI installed")
    def test_the_real_cli_rejects_the_old_shape_and_accepts_this_one(self, tmp_path) -> None:
        # Argument validation happens before authentication, so this reaches no
        # network and needs no credentials. Config is pointed at an empty file so the
        # accepted shape fails on credentials rather than talking to anything.
        empty = tmp_path / "empty.cfg"
        empty.write_text("")
        environment = {
            "PATH": "/usr/bin:/bin:/usr/local/bin",
            "HOME": str(tmp_path),
            "DATABRICKS_CONFIG_FILE": str(empty),
        }
        base = ["databricks", "account", "access-control", "get-rule-set", self.NAME]

        rejected = subprocess.run(
            [*base, "etag", "", "--output", "json"],
            capture_output=True,
            text=True,
            env=environment,
            timeout=60,
            check=False,
        )
        assert rejected.returncode != 0
        assert "accepts 2 arg(s), received 3" in rejected.stderr + rejected.stdout

        accepted = subprocess.run(
            [*base, "", "--output", "json"],
            capture_output=True,
            text=True,
            env=environment,
            timeout=60,
            check=False,
        )
        combined = accepted.stderr + accepted.stdout
        assert "accepts 2 arg(s)" not in combined, combined
        # It gets past parsing and fails on credentials, which is as far as an
        # offline test can go.
        assert "auth" in combined.lower() or accepted.returncode == 0


class TestPinnedSmokeStart:
    """The smoke run is started through a command that actually returns a run id.

    `bundle run <job> --no-wait` does not: in the pinned CLI the job runner's no-wait
    branch returns no run output, so the command marshals nothing and stdout is
    empty. No fixture here pretends otherwise -- `test_an_empty_start_response_is_refused`
    feeds exactly what that command would have produced.
    """

    SUMMARY: ClassVar[dict] = {
        "resources": {
            "jobs": {
                "centrum_v3_sql_objects": {
                    "id": "620161591442",
                    "name": "[dev] Centrum v3 SQL objects",
                    "run_as": {"service_principal_name": "node-sp"},
                },
                "centrum_v3_smoke": {"id": "12345", "name": "[dev] Centrum v3 smoke"},
            }
        }
    }

    @pytest.fixture
    def smoke(self):
        return load("smoke_job_run.py")

    def fake_cli(self, smoke, monkeypatch, responses: dict) -> list[list[str]]:
        """Record argv and answer with the given canned CLI stdout."""
        calls: list[list[str]] = []

        def run_cli(arguments: list[str]) -> str:
            calls.append(arguments)
            for prefix, response in responses.items():
                if arguments[: len(prefix.split())] == prefix.split():
                    return response.pop(0) if isinstance(response, list) else response
            raise AssertionError(f"unexpected call: {arguments}")

        monkeypatch.setattr(smoke, "run_cli", run_cli)
        return calls

    # --- job id resolution

    def test_the_deployed_id_comes_from_the_summary(self, smoke) -> None:
        assert smoke.resolve_job_id(self.SUMMARY, "centrum_v3_sql_objects") == "620161591442"

    def test_an_absent_job_key_names_what_the_bundle_does_declare(self, smoke) -> None:
        with pytest.raises(smoke.SmokeRunError, match="centrum_v3_smoke"):
            smoke.resolve_job_id(self.SUMMARY, "not_deployed")

    def test_an_undeployed_summary_falls_back_to_an_exact_name_lookup(self, smoke, monkeypatch) -> None:
        # `id` is deployment state, so a summary read before deploy has only the name.
        summary = {"resources": {"jobs": {"k": {"name": "[dev] Centrum v3 SQL objects"}}}}
        calls = self.fake_cli(
            smoke,
            monkeypatch,
            {
                "jobs list": json.dumps(
                    [{"job_id": 777, "settings": {"name": "[dev] Centrum v3 SQL objects"}}]
                )
            },
        )
        assert smoke.resolve_job_id(summary, "k") == "777"
        assert calls == [["jobs", "list", "--name", "[dev] Centrum v3 SQL objects", "--output", "json"]]

    def test_a_case_variant_match_is_not_the_job(self, smoke, monkeypatch) -> None:
        # `jobs list --name` filters case-insensitively; starting a different job and
        # attesting its result would be worse than failing.
        summary = {"resources": {"jobs": {"k": {"name": "Centrum v3 SQL objects"}}}}
        self.fake_cli(
            smoke,
            monkeypatch,
            {"jobs list": json.dumps([{"job_id": 1, "settings": {"name": "centrum v3 sql OBJECTS"}}])},
        )
        with pytest.raises(smoke.SmokeRunError, match="exactly one"):
            smoke.resolve_job_id(summary, "k")

    def test_two_jobs_with_the_same_name_stop_the_phase(self, smoke, monkeypatch) -> None:
        summary = {"resources": {"jobs": {"k": {"name": "Ambiguous"}}}}
        self.fake_cli(
            smoke,
            monkeypatch,
            {
                "jobs list": json.dumps(
                    [
                        {"job_id": 1, "settings": {"name": "Ambiguous"}},
                        {"job_id": 2, "settings": {"name": "Ambiguous"}},
                    ]
                )
            },
        )
        with pytest.raises(smoke.SmokeRunError, match="found 2"):
            smoke.resolve_job_id(summary, "k")

    # --- starting the run

    def test_run_now_is_called_with_the_documented_argv(self, smoke, monkeypatch) -> None:
        calls = self.fake_cli(
            smoke,
            monkeypatch,
            # The documented RunNowResponse: run_id plus number_in_job.
            {"jobs run-now": json.dumps({"run_id": 8675309, "number_in_job": 8675309})},
        )
        assert smoke.start_run("620161591442") == "8675309"
        assert calls == [["jobs", "run-now", "620161591442", "--no-wait", "--output", "json"]]

    def test_an_empty_start_response_is_refused(self, smoke, monkeypatch) -> None:
        # Exactly what `bundle run <job> --no-wait --output json` writes on the pinned
        # CLI: nothing. There is no id to attest, so the phase fails.
        self.fake_cli(smoke, monkeypatch, {"jobs run-now": ""})
        with pytest.raises(smoke.SmokeRunError, match="returned nothing"):
            smoke.start_run("1")

    def test_a_run_url_is_not_a_run_id(self, smoke, monkeypatch) -> None:
        # The pinned no-wait branch prints a URL to the log. Scraping it is exactly
        # the "synthesize an id from presentation output" this must not do.
        self.fake_cli(
            smoke, monkeypatch, {"jobs run-now": "https://dbc-x.cloud.databricks.com/#job/1/run/2\n"}
        )
        with pytest.raises(smoke.SmokeRunError, match="non-JSON"):
            smoke.start_run("1")

    @pytest.mark.parametrize(
        "response", ['{"number_in_job": 5}', '{"run_id": ""}', '{"run_id": "not-a-number"}', "[]"]
    )
    def test_a_response_without_a_numeric_run_id_is_refused(self, smoke, monkeypatch, response) -> None:
        self.fake_cli(smoke, monkeypatch, {"jobs run-now": response})
        with pytest.raises(smoke.SmokeRunError):
            smoke.start_run("1")

    # --- polling that exact id

    def poll(self, smoke, monkeypatch, states: list[str]) -> tuple[str, list[list[str]]]:
        calls = self.fake_cli(smoke, monkeypatch, {"jobs get-run": list(states)})
        return smoke.poll_run("8675309", attempts=len(states), interval=0, sleep=lambda _: None), calls

    def test_a_successful_run_is_polled_to_its_terminal_state(self, smoke, monkeypatch) -> None:
        result, calls = self.poll(
            smoke,
            monkeypatch,
            [
                json.dumps({"state": {"life_cycle_state": "PENDING"}}),
                json.dumps({"state": {"life_cycle_state": "RUNNING"}}),
                json.dumps({"state": {"life_cycle_state": "TERMINATED", "result_state": "SUCCESS"}}),
            ],
        )
        assert result == "SUCCESS"
        assert calls[0] == ["jobs", "get-run", "8675309", "--output", "json"]
        assert len(calls) == 3, "it must keep polling until the run is actually over"

    @pytest.mark.parametrize(
        "life_cycle,result_state",
        [("TERMINATED", "FAILED"), ("TERMINATED", "TIMEDOUT"), ("INTERNAL_ERROR", "FAILED")],
    )
    def test_any_other_terminal_state_fails_the_phase(
        self, smoke, monkeypatch, life_cycle, result_state
    ) -> None:
        with pytest.raises(smoke.SmokeRunError, match=result_state):
            self.poll(
                smoke,
                monkeypatch,
                [json.dumps({"state": {"life_cycle_state": life_cycle, "result_state": result_state}})],
            )

    def test_the_current_status_shape_is_understood_too(self, smoke, monkeypatch) -> None:
        result, _ = self.poll(
            smoke,
            monkeypatch,
            [json.dumps({"status": {"state": "TERMINATED", "termination_details": {"code": "SUCCESS"}}})],
        )
        assert result == "SUCCESS"

    def test_a_run_that_never_finishes_is_not_a_success(self, smoke, monkeypatch) -> None:
        with pytest.raises(smoke.SmokeRunError, match="terminal state in time"):
            self.poll(smoke, monkeypatch, [json.dumps({"state": {"life_cycle_state": "RUNNING"}})] * 3)

    def test_terminating_without_a_result_is_not_terminal(self, smoke, monkeypatch) -> None:
        # It is still moving; its result state is not final yet.
        with pytest.raises(smoke.SmokeRunError, match="terminal state in time"):
            self.poll(smoke, monkeypatch, [json.dumps({"state": {"life_cycle_state": "TERMINATING"}})] * 2)

    # --- only a coherent TERMINATED/SUCCESS pair counts

    @pytest.mark.parametrize("life_cycle", ["SKIPPED", "INTERNAL_ERROR"])
    def test_a_terminal_failure_next_to_a_success_result_is_still_a_failure(
        self, smoke, monkeypatch, life_cycle
    ) -> None:
        # The fixup-06 hole: lifecycle and result were checked independently, so
        # SKIPPED/SUCCESS passed. SKIPPED means the run was abandoned because another
        # was already active and INTERNAL_ERROR is a Jobs service failure; neither ran
        # the fixtures, and a response pairing them with SUCCESS contradicts itself.
        with pytest.raises(smoke.SmokeRunError, match=f"ended {life_cycle}"):
            self.poll(
                smoke,
                monkeypatch,
                [json.dumps({"state": {"life_cycle_state": life_cycle, "result_state": "SUCCESS"}})],
            )

    @pytest.mark.parametrize("life_cycle", ["SKIPPED", "INTERNAL_ERROR"])
    def test_a_terminal_failure_without_any_result_is_a_failure_too(
        self, smoke, monkeypatch, life_cycle
    ) -> None:
        with pytest.raises(smoke.SmokeRunError, match="no result"):
            self.poll(smoke, monkeypatch, [json.dumps({"state": {"life_cycle_state": life_cycle}})])

    def test_the_undocumented_composite_result_is_not_success(self, smoke, monkeypatch) -> None:
        # `TERMINATED_SUCCESS` is in neither pinned enum: the legacy result state and
        # the current termination code both spell success `SUCCESS`. A value nothing
        # produces is a value somebody typed.
        assert "TERMINATED_SUCCESS" not in (REPO_DATA / "scripts/smoke_job_run.py").read_text()
        with pytest.raises(smoke.SmokeRunError, match="TERMINATED_SUCCESS"):
            self.poll(
                smoke,
                monkeypatch,
                [
                    json.dumps(
                        {"state": {"life_cycle_state": "TERMINATED", "result_state": "TERMINATED_SUCCESS"}}
                    )
                ],
            )

    def test_both_shapes_agreeing_is_accepted(self, smoke, monkeypatch) -> None:
        result, _ = self.poll(
            smoke,
            monkeypatch,
            [
                json.dumps(
                    {
                        "state": {"life_cycle_state": "TERMINATED", "result_state": "SUCCESS"},
                        "status": {"state": "TERMINATED", "termination_details": {"code": "SUCCESS"}},
                    }
                )
            ],
        )
        assert result == "SUCCESS"

    @pytest.mark.parametrize(
        "state,status",
        [
            (
                {"life_cycle_state": "TERMINATED", "result_state": "FAILED"},
                {"state": "TERMINATED", "termination_details": {"code": "SUCCESS"}},
            ),
            (
                {"life_cycle_state": "TERMINATED", "result_state": "SUCCESS"},
                {"state": "INTERNAL_ERROR", "termination_details": {"code": "SUCCESS"}},
            ),
            (
                {"life_cycle_state": "RUNNING"},
                {"state": "TERMINATED", "termination_details": {"code": "SUCCESS"}},
            ),
        ],
    )
    def test_conflicting_shapes_are_refused_rather_than_combined(
        self, smoke, monkeypatch, state, status
    ) -> None:
        # Taking the lifecycle from one shape and the result from the other is how a
        # self-contradicting response becomes a green smoke.
        with pytest.raises(smoke.SmokeRunError, match="contradicts itself"):
            self.poll(smoke, monkeypatch, [json.dumps({"state": state, "status": status})])

    @pytest.mark.parametrize("run", ["{}", '{"run_id": 1}', '{"metadata": {"job_id": 4}}'])
    def test_a_response_reporting_no_state_is_refused(self, smoke, monkeypatch, run) -> None:
        with pytest.raises(smoke.SmokeRunError, match="no state at all"):
            self.poll(smoke, monkeypatch, [run])

    @pytest.mark.parametrize("life_cycle", ["FINISHED", "OK", "terminated", "SUCCESS"])
    def test_an_unknown_lifecycle_stops_immediately(self, smoke, monkeypatch, life_cycle) -> None:
        # Including the lowercase spelling and a result value in the lifecycle slot:
        # neither can be interpreted, and polling them to the deadline would report a
        # timeout for what is really a malformed response.
        states = [json.dumps({"state": {"life_cycle_state": life_cycle, "result_state": "SUCCESS"}})] * 3
        calls = self.fake_cli(smoke, monkeypatch, {"jobs get-run": list(states)})
        with pytest.raises(smoke.SmokeRunError, match="unknown state"):
            smoke.poll_run("8675309", attempts=3, interval=0, sleep=lambda _: None)
        assert len(calls) == 1, "an uninterpretable state must not be polled to the deadline"

    def test_a_terminated_run_whose_result_has_not_landed_keeps_polling(self, smoke, monkeypatch) -> None:
        # TERMINATED with no result yet is not readable as either outcome, so it is
        # polled for the coherent pair and times out rather than passing.
        result, calls = self.poll(
            smoke,
            monkeypatch,
            [
                json.dumps({"state": {"life_cycle_state": "TERMINATED"}}),
                json.dumps({"state": {"life_cycle_state": "TERMINATED", "result_state": "SUCCESS"}}),
            ],
        )
        assert result == "SUCCESS"
        assert len(calls) == 2

    def test_a_terminated_run_that_never_reports_a_result_is_not_a_success(self, smoke, monkeypatch) -> None:
        with pytest.raises(smoke.SmokeRunError, match="terminal state in time"):
            self.poll(smoke, monkeypatch, [json.dumps({"state": {"life_cycle_state": "TERMINATED"}})] * 3)

    @pytest.mark.parametrize(
        "code",
        ["CANCELED", "SKIPPED", "SUCCESS_WITH_FAILURES", "DRIVER_ERROR", "MAX_CONCURRENT_RUNS_REACHED"],
    )
    def test_no_other_termination_code_passes(self, smoke, monkeypatch, code) -> None:
        with pytest.raises(smoke.SmokeRunError, match=code):
            self.poll(
                smoke,
                monkeypatch,
                [json.dumps({"status": {"state": "TERMINATED", "termination_details": {"code": code}}})],
            )

    # --- a present shape is a shape, and enum strings are compared raw

    LEGACY_SUCCESS: ClassVar[dict] = {"life_cycle_state": "TERMINATED", "result_state": "SUCCESS"}
    CURRENT_SUCCESS: ClassVar[dict] = {
        "state": "TERMINATED",
        "termination_details": {"code": "SUCCESS", "type": "SUCCESS", "message": "ok"},
    }

    @pytest.mark.parametrize(
        "label,run",
        [
            # The five probes the fixup-07 review ran, all of which returned SUCCESS.
            ("empty legacy sibling", {"state": {}, "status": CURRENT_SUCCESS}),
            ("legacy sibling is a string", {"state": "not-an-object", "status": CURRENT_SUCCESS}),
            ("empty current sibling", {"state": LEGACY_SUCCESS, "status": {}}),
            (
                "whitespace-padded legacy pair",
                {"state": {"life_cycle_state": " TERMINATED ", "result_state": " SUCCESS "}},
            ),
            (
                "shapes equal only after trimming",
                {
                    "state": {"life_cycle_state": " TERMINATED ", "result_state": "SUCCESS"},
                    "status": {"state": "TERMINATED", "termination_details": {"code": " SUCCESS "}},
                },
            ),
        ],
    )
    def test_a_malformed_or_normalized_shape_cannot_attest_success(
        self, smoke, monkeypatch, label, run
    ) -> None:
        # Key presence is what makes a shape present. Downgrading an empty or
        # malformed member to "absent" left its well-formed sibling to attest on its
        # own, and rewriting ` TERMINATED ` into `TERMINATED` turned a response the
        # API never sent into the one value that opens production.
        with pytest.raises(smoke.SmokeRunError):
            self.poll(smoke, monkeypatch, [json.dumps(run)])

    @pytest.mark.parametrize(
        "run",
        [
            {"state": None, "status": CURRENT_SUCCESS},
            {"state": [], "status": CURRENT_SUCCESS},
            {"state": LEGACY_SUCCESS, "status": None},
            {"state": LEGACY_SUCCESS, "status": "TERMINATED"},
        ],
    )
    def test_a_present_but_non_object_shape_is_malformed_not_absent(self, smoke, monkeypatch, run) -> None:
        with pytest.raises(smoke.SmokeRunError, match="not an object"):
            self.poll(smoke, monkeypatch, [json.dumps(run)])

    @pytest.mark.parametrize(
        "run",
        [
            {"state": {"life_cycle_state": 1, "result_state": "SUCCESS"}},
            {"state": {"life_cycle_state": "TERMINATED", "result_state": ["SUCCESS"]}},
            {"state": {"life_cycle_state": "TERMINATED", "result_state": None}},
            {"state": {"life_cycle_state": "", "result_state": "SUCCESS"}},
            {"state": {"life_cycle_state": "TERMINATED", "result_state": ""}},
            {"status": {"state": True, "termination_details": {"code": "SUCCESS"}}},
            {"status": {"state": "TERMINATED", "termination_details": {"code": 0}}},
            {"status": {"state": "TERMINATED", "termination_details": {"code": {"value": "SUCCESS"}}}},
        ],
    )
    def test_a_non_string_or_empty_enum_value_is_refused(self, smoke, monkeypatch, run) -> None:
        with pytest.raises(smoke.SmokeRunError, match="documented enum strings"):
            self.poll(smoke, monkeypatch, [json.dumps(run)])

    def test_termination_details_must_be_an_object_when_present(self, smoke, monkeypatch) -> None:
        with pytest.raises(smoke.SmokeRunError, match="termination_details"):
            self.poll(
                smoke,
                monkeypatch,
                [json.dumps({"status": {"state": "TERMINATED", "termination_details": "SUCCESS"}})],
            )

    @pytest.mark.parametrize(
        "run",
        [
            {"state": {"result_state": "SUCCESS"}},
            {"status": {"termination_details": {"code": "SUCCESS"}}},
        ],
    )
    def test_a_partial_shape_without_its_lifecycle_is_refused(self, smoke, monkeypatch, run) -> None:
        with pytest.raises(smoke.SmokeRunError, match=r"no life_cycle_state|no state"):
            self.poll(smoke, monkeypatch, [json.dumps(run)])

    @pytest.mark.parametrize(
        "run",
        [
            {"state": LEGACY_SUCCESS},
            {"status": CURRENT_SUCCESS},
            {"state": LEGACY_SUCCESS, "status": CURRENT_SUCCESS},
        ],
    )
    def test_the_three_exact_success_shapes_are_still_accepted(self, smoke, monkeypatch, run) -> None:
        # Strictness must not cost the real cases: legacy alone, current alone, and a
        # real v2.2 response carrying both -- extra `type`/`message` detail included.
        result, _ = self.poll(smoke, monkeypatch, [json.dumps(run)])
        assert result == "SUCCESS"

    def test_a_well_formed_terminated_shape_without_a_result_still_polls(self, smoke, monkeypatch) -> None:
        # The intentional behaviour the review asked to keep: `result_state` absent
        # (not empty, not null) is "not landed yet", so it polls for the real pair.
        result, calls = self.poll(
            smoke,
            monkeypatch,
            [
                json.dumps({"state": {"life_cycle_state": "TERMINATED"}}),
                json.dumps({"state": self.LEGACY_SUCCESS}),
            ],
        )
        assert result == "SUCCESS"
        assert len(calls) == 2

    def test_both_shapes_agreeing_that_the_result_has_not_landed_still_polls(
        self, smoke, monkeypatch
    ) -> None:
        # A real in-flight v2.2 response: both members present, both saying RUNNING.
        with pytest.raises(smoke.SmokeRunError, match="terminal state in time"):
            self.poll(
                smoke,
                monkeypatch,
                [json.dumps({"state": {"life_cycle_state": "RUNNING"}, "status": {"state": "RUNNING"}})] * 2,
            )

    def test_the_state_reader_never_normalizes(self, smoke) -> None:
        # Guards the property directly rather than through the poller: whatever the
        # response said is what comes back, byte for byte.
        assert smoke.run_state({"state": {"life_cycle_state": "RUNNING"}}) == ("RUNNING", None)
        assert smoke.run_state({"state": self.LEGACY_SUCCESS}) == ("TERMINATED", "SUCCESS")
        assert smoke.run_state({"status": self.CURRENT_SUCCESS}) == ("TERMINATED", "SUCCESS")
        reader = "".join(
            inspect.getsource(function)
            for function in (smoke.run_state, smoke._legacy_pair, smoke._current_pair, smoke._raw_enum)
        )
        for coercion in (".strip()", ".upper()", ".lower()", ".casefold()", "str("):
            assert coercion not in reader, f"{coercion} would make a non-exact value exact"

    # --- end to end, through a real subprocess

    def test_the_cli_records_the_real_run_id_and_state(self, smoke, tmp_path) -> None:
        summary = tmp_path / "summary.json"
        summary.write_text(json.dumps(self.SUMMARY))
        output = tmp_path / "github-output.txt"
        binary = tmp_path / "bin"
        binary.mkdir()
        (binary / "databricks").write_text(
            "#!/usr/bin/env python3\n"
            "import json, sys\n"
            "argv = sys.argv[1:]\n"
            f"open({str(tmp_path / 'argv.log')!r}, 'a').write(json.dumps(argv) + chr(10))\n"
            "if argv[:2] == ['jobs', 'run-now']:\n"
            "    print(json.dumps({'run_id': 8675309, 'number_in_job': 3}))\n"
            "elif argv[:2] == ['jobs', 'get-run']:\n"
            "    print(json.dumps({'state': {'life_cycle_state': 'TERMINATED', 'result_state': 'SUCCESS'}}))\n"
            "else:\n"
            "    sys.exit('unexpected ' + ' '.join(argv))\n"
        )
        (binary / "databricks").chmod(0o755)
        original = os.environ["PATH"]
        os.environ["PATH"] = f"{binary}:{original}"
        try:
            code = smoke.main(
                [
                    "--summary-file",
                    str(summary),
                    "--job-key",
                    "centrum_v3_sql_objects",
                    "--output-file",
                    str(output),
                    "--attempts",
                    "2",
                    "--interval",
                    "0",
                ]
            )
        finally:
            os.environ["PATH"] = original
        assert code == 0
        assert dict(line.split("=", 1) for line in output.read_text().splitlines()) == {
            "run_id": "8675309",
            "state": "SUCCESS",
        }
        argv = [json.loads(line) for line in (tmp_path / "argv.log").read_text().splitlines()]
        assert argv[0] == ["jobs", "run-now", "620161591442", "--no-wait", "--output", "json"]
        assert argv[1] == ["jobs", "get-run", "8675309", "--output", "json"]

    def test_the_run_id_is_recorded_before_polling_can_time_out(self, smoke, tmp_path) -> None:
        # A run that starts and then hangs must still be identifiable afterwards.
        summary = tmp_path / "summary.json"
        summary.write_text(json.dumps(self.SUMMARY))
        output = tmp_path / "github-output.txt"
        binary = tmp_path / "bin"
        binary.mkdir()
        (binary / "databricks").write_text(
            "#!/usr/bin/env python3\n"
            "import json, sys\n"
            "argv = sys.argv[1:]\n"
            "if argv[:2] == ['jobs', 'run-now']:\n"
            "    print(json.dumps({'run_id': 999}))\n"
            "else:\n"
            "    print(json.dumps({'state': {'life_cycle_state': 'RUNNING'}}))\n"
        )
        (binary / "databricks").chmod(0o755)
        original = os.environ["PATH"]
        os.environ["PATH"] = f"{binary}:{original}"
        try:
            code = smoke.main(
                [
                    "--summary-file",
                    str(summary),
                    "--job-key",
                    "centrum_v3_sql_objects",
                    "--output-file",
                    str(output),
                    "--attempts",
                    "2",
                    "--interval",
                    "0",
                ]
            )
        finally:
            os.environ["PATH"] = original
        assert code == 1
        assert output.read_text().strip() == "run_id=999"

    # --- and the workflow uses exactly this

    def test_the_workflow_no_longer_asks_bundle_run_for_an_id(self, rollout: dict) -> None:
        script = step_script(rollout, "smoke", "Register the SQL objects")
        commands = "\n".join(line for line in script.splitlines() if not line.strip().startswith("#"))
        assert "bundle run" not in commands, "that command returns no run id on the pinned CLI"
        assert "bundle summary -t" in script and "--output json" in script
        assert "smoke_job_run.py" in script
        assert ":-" not in script, "no fallback may stand in for a real run id or state"
        assert "GITHUB_RUN_ID" not in script and "github.run_id" not in script

    def test_the_smoke_job_key_is_a_bundle_resource(self, rollout: dict) -> None:
        # The key the phase resolves has to be the one the bundle actually declares.
        bundle = yaml.safe_load((REPO_DATA / "databricks.yml").read_text())
        includes = bundle.get("include") or []
        declared = set()
        for pattern in includes:
            for path in sorted(REPO_DATA.glob(pattern)):
                resources = (yaml.safe_load(path.read_text()) or {}).get("resources") or {}
                declared |= set(resources.get("jobs") or {})
        declared |= set((bundle.get("resources") or {}).get("jobs") or {})
        assert "centrum_v3_sql_objects" in declared, sorted(declared)


# --- bundle plan evidence --------------------------------------------------


class TestBundlePlanEvidence:
    def test_the_deploy_refuses_without_the_approved_plan(self, rollout: dict, sandbox) -> None:
        sandbox.stub("python", "exit 0")
        script = step_script(rollout, "bundle-deploy", "Re-verify the approved bundle plan")
        result = sandbox.run(
            script,
            TARGET_ENV="dev",
            HEAD_SHA="a" * 40,
            RUN_ID="1",
            RUN_ATTEMPT="1",
            CONFIG_DIGEST="c",
            INVENTORY_ETAG="e",
            OLD_WHEEL="openjii-0.1.0-py3-none-any.whl",
        )
        assert result.returncode != 0, "a missing bundle plan must stop the deploy"
        assert "verify-binding" not in " ".join(sandbox.calls())

    def test_the_deploy_refuses_without_the_wheel_backup(self, rollout: dict, sandbox) -> None:
        (sandbox.root / "bundle-plan.json").write_text("{}")
        sandbox.stub("python", "exit 0")
        script = step_script(rollout, "bundle-deploy", "Re-verify the approved bundle plan")
        result = sandbox.run(
            script,
            TARGET_ENV="dev",
            HEAD_SHA="a" * 40,
            RUN_ID="1",
            RUN_ATTEMPT="1",
            CONFIG_DIGEST="c",
            INVENTORY_ETAG="e",
            OLD_WHEEL="openjii-0.1.0-py3-none-any.whl",
        )
        assert result.returncode != 0, "without the backup there is nothing to restore from"

    def test_a_complete_evidence_set_verifies_the_binding(self, rollout: dict, sandbox) -> None:
        (sandbox.root / "bundle-plan.json").write_text('{"resources": {}}')
        (sandbox.root / "wheel-backup").mkdir()
        (sandbox.root / "wheel-backup/openjii-0.1.0-py3-none-any.whl").write_text("wheel bytes")
        sandbox.stub("python", "exit 0")
        script = step_script(rollout, "bundle-deploy", "Re-verify the approved bundle plan")
        result = sandbox.run(
            script,
            TARGET_ENV="dev",
            HEAD_SHA="a" * 40,
            RUN_ID="1",
            RUN_ATTEMPT="1",
            CONFIG_DIGEST="c",
            INVENTORY_ETAG="e",
            OLD_WHEEL="openjii-0.1.0-py3-none-any.whl",
        )
        assert result.returncode == 0, result.stdout + result.stderr
        calls = " ".join(sandbox.calls())
        assert "verify-binding" in calls
        # The digest is computed from the downloaded file, not carried alongside it.
        digest = subprocess.run(
            ["sha256sum", str(sandbox.root / "bundle-plan.json")], capture_output=True, text=True, check=True
        ).stdout.split()[0]
        assert digest in calls


# --- wheel retention on every outcome --------------------------------------


class TestWheelRetentionCleanup:
    def script(self, rollout: dict) -> str:
        return step_script(rollout, "bundle-deploy", "restore the outgoing wheel")

    def prepare(self, sandbox, *, present: bool, backup: bool, restore_works: bool = True) -> None:
        flag = sandbox.root / "present"
        if present:
            flag.write_text("yes")
        sandbox.stub(
            "python",
            f"""
if [ -f {flag} ]; then exit 0; fi
if [ -f {sandbox.root}/restored ] && {"true" if restore_works else "false"}; then exit 0; fi
exit 1
""",
        )
        sandbox.stub("databricks", f"touch {sandbox.root}/restored")
        if backup:
            (sandbox.root / "wheel-backup").mkdir(exist_ok=True)
            (sandbox.root / "wheel-backup/openjii-0.1.0-py3-none-any.whl").write_text("wheel bytes")

    def run(self, rollout: dict, sandbox, status: str, wheel: str = "openjii-0.1.0-py3-none-any.whl"):
        return sandbox.run(self.script(rollout), TARGET_ENV="dev", OLD_WHEEL=wheel, JOB_STATUS=status)

    def test_the_step_runs_on_success_too(self, rollout: dict) -> None:
        step = next(
            s
            for s in rollout["jobs"]["bundle-deploy"]["steps"]
            if "restore the outgoing wheel" in s.get("name", "").lower()
        )
        assert "always()" in str(step["if"])

    def test_an_intact_wheel_and_a_successful_deploy_pass(self, rollout: dict, sandbox) -> None:
        self.prepare(sandbox, present=True, backup=True)
        result = self.run(rollout, sandbox, "success")
        assert result.returncode == 0, result.stdout + result.stderr
        assert "workspace import" not in " ".join(sandbox.calls())

    def test_a_pruned_wheel_after_a_successful_deploy_is_restored_and_fails(
        self, rollout: dict, sandbox
    ) -> None:
        # The case `failure()` could not see: the deploy succeeded, retention pruned
        # the outgoing wheel, and the live references still name it for two more
        # phases. Nothing else in the run would have noticed.
        self.prepare(sandbox, present=False, backup=True)
        result = self.run(rollout, sandbox, "success")
        assert result.returncode == 1
        assert "workspace import" in " ".join(sandbox.calls())
        assert "restored" in result.stdout

    def test_a_failed_deploy_still_proves_retention_then_fails(self, rollout: dict, sandbox) -> None:
        self.prepare(sandbox, present=True, backup=True)
        result = self.run(rollout, sandbox, "failure")
        assert result.returncode == 1
        assert "is intact" in result.stdout

    def test_a_pruned_wheel_with_no_backup_says_exactly_what_to_do(self, rollout: dict, sandbox) -> None:
        self.prepare(sandbox, present=False, backup=False)
        result = self.run(rollout, sandbox, "failure")
        assert result.returncode == 1
        assert "no backup is available" in result.stdout
        assert "artifact" in result.stdout, "the operator needs the recovery path"

    def test_a_restore_that_does_not_take_is_not_reported_as_recovered(self, rollout: dict, sandbox) -> None:
        self.prepare(sandbox, present=False, backup=True, restore_works=False)
        result = self.run(rollout, sandbox, "success")
        assert result.returncode == 1
        assert "could not be restored" in result.stdout

    def test_a_missing_outgoing_wheel_is_not_silently_fine(self, rollout: dict, sandbox) -> None:
        self.prepare(sandbox, present=True, backup=True)
        result = self.run(rollout, sandbox, "failure", wheel="")
        assert result.returncode == 1
        assert "nothing can be proven" in result.stdout


# --- run-as probe cleanup --------------------------------------------------


class TestProbeCleanup:
    NAME = "zz-preflight-run-as-tok"

    def fake_cli(self, preflight, monkeypatch, create: str, listed: list[dict]) -> list[list[str]]:
        calls: list[list[str]] = []

        def run_cli(args: list[str], *, capture: bool = True) -> str:
            calls.append(args)
            if args[:2] == ["jobs", "create"]:
                return create
            if args[:2] == ["jobs", "list"]:
                return json.dumps(listed)
            return "{}"

        monkeypatch.setattr(preflight, "run_cli", run_cli)
        return calls

    def deletes(self, calls: list[list[str]]) -> list[str]:
        return [c[2] for c in calls if c[:2] == ["jobs", "delete"]]

    def test_a_probe_created_before_the_parse_failed_is_still_deleted(self, preflight, monkeypatch) -> None:
        # Create succeeds server-side, the response cannot be parsed. Under fixup 04
        # this left a job carrying run_as of the node principal behind forever.
        calls = self.fake_cli(
            preflight,
            monkeypatch,
            create="{truncated",
            listed=[
                {"job_id": 777, "settings": {"name": self.NAME}},
                {"job_id": 888, "settings": {"name": "someone-elses-job"}},
            ],
        )
        with pytest.raises(preflight.PreflightError, match="unparseable"):
            preflight.prove_run_as("sp", "tok")
        assert self.deletes(calls) == ["777"], "only the exact-name probe may be deleted"

    def test_a_response_without_an_id_falls_back_to_the_exact_name(self, preflight, monkeypatch) -> None:
        calls = self.fake_cli(
            preflight,
            monkeypatch,
            create=json.dumps({"warning": "no id"}),
            listed=[{"job_id": 42, "settings": {"name": self.NAME}}],
        )
        with pytest.raises(preflight.PreflightError, match="without a job_id"):
            preflight.prove_run_as("sp", "tok")
        assert self.deletes(calls) == ["42"]

    def test_a_non_object_response_is_refused(self, preflight, monkeypatch) -> None:
        calls = self.fake_cli(preflight, monkeypatch, create="[1, 2, 3]", listed=[])
        with pytest.raises(preflight.PreflightError, match="unexpected create response"):
            preflight.prove_run_as("sp", "tok")
        assert self.deletes(calls) == []

    def test_the_happy_path_deletes_by_id_without_listing(self, preflight, monkeypatch) -> None:
        calls = self.fake_cli(preflight, monkeypatch, create=json.dumps({"job_id": 99}), listed=[])
        preflight.prove_run_as("sp", "tok")
        assert self.deletes(calls) == ["99"]
        assert not any(c[:2] == ["jobs", "list"] for c in calls)

    def test_cleanup_failure_does_not_swallow_the_original_error(self, preflight, monkeypatch) -> None:
        def run_cli(args: list[str], *, capture: bool = True) -> str:
            if args[:2] == ["jobs", "create"]:
                return json.dumps({})
            raise preflight.PreflightError("list denied")

        monkeypatch.setattr(preflight, "run_cli", run_cli)
        with pytest.raises(preflight.PreflightError, match="without a job_id"):
            preflight.prove_run_as("sp", "tok")

    def test_a_probe_name_is_never_built_from_a_workflow_expression(self, rollout: dict) -> None:
        step = next(
            s for s in rollout["jobs"]["bundle-deploy"]["steps"] if "Preflight run-as" in s.get("name", "")
        )
        assert '--probe-token "$PROBE_TOKEN"' in step["run"]
        assert re.fullmatch(r"roll\$\{\{ github\.run_id \}\}", step["env"]["PROBE_TOKEN"])
