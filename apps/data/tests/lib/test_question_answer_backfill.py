import copy
from uuid import uuid4

import pytest
from openjii.question_answer_backfill import _report, run_backfill, validate_manifest


def manifest():
    return {
        "version": 1,
        "evidence": "Reviewed complete preflight input hash and cutoff",
        "experiments": {"f1630d63-0d73-4f4d-8072-3f4acdef06e7": ["height"]},
        "tables": {
            role: {
                "name": f"catalog.centrum.experiment_{role}",
                "backup": f"catalog.backups.original_{role}",
                "source_version": 4,
                "table_id": "ce9342ee-5176-44b4-befe-9948c04b1c51",
            }
            for role in ["raw_data", "macro_data"]
        },
    }


def test_manifest_fingerprint_is_stable_and_apply_requires_the_reviewed_inputs():
    value = manifest()
    assert validate_manifest(value) == validate_manifest(copy.deepcopy(value))
    changed = copy.deepcopy(value)
    changed["experiments"][next(iter(changed["experiments"]))] = ["other"]
    assert validate_manifest(value) != validate_manifest(changed)
    with pytest.raises(ValueError, match="reviewed"):
        run_backfill(None, value, apply=True)


@pytest.mark.parametrize(
    "mutation",
    [
        lambda value: value.update(evidence=""),
        lambda value: value["tables"].pop("macro_data"),
        lambda value: value["tables"]["raw_data"].update(name="catalog.centrum.raw_data; DELETE"),
        lambda value: value["tables"]["raw_data"].update(backup="catalog.centrum.experiment_raw_data"),
        lambda value: value["tables"]["raw_data"].update(source_version=-1),
        lambda value: value["experiments"].update({"bad-id": ["height"]}),
        lambda value: value["experiments"].update({next(iter(value["experiments"])): ["height", "height"]}),
    ],
)
def test_unsafe_or_incomplete_manifest_is_rejected(mutation):
    value = manifest()
    mutation(value)
    with pytest.raises(ValueError):
        validate_manifest(value)


@pytest.mark.spark
def test_dry_run_counts_changes_invalid_numbers_and_preserves_source(spark):
    database = "qa_question_backfill_" + uuid4().hex[:8]
    spark.sql(f"CREATE DATABASE {database}")
    try:
        experiment_id = next(iter(manifest()["experiments"]))
        spark.sql(f"""CREATE VIEW {database}.experiment_raw_data AS
          SELECT '{experiment_id}' AS experiment_id, parse_json(json) AS questions_data,
                 parse_json(json) AS questions_original_data
          FROM VALUES ('{{"height":"12.50","plot":"007"}}'),
                      ('{{"height":"NaN"}}'), ('{{"height":"  "}}'),
                      ('{{"height":null}}'), ('{{"height":12.5}}') t(json)""")
        report = _report(
            spark, {"name": f"spark_catalog.{database}.experiment_raw_data"}, experiment_id, ["height"]
        )
        assert report == {
            "experiment_id": experiment_id,
            "rows": 5,
            "changed_rows": 3,
            "invalid_numbers": 1,
            "invalid_by_key": {"height": 1},
            "new_invalid_numbers": 1,
        }
        assert spark.sql(f"SELECT count(*) FROM {database}.experiment_raw_data").first()[0] == 5
    finally:
        spark.sql(f"DROP DATABASE {database} CASCADE")


def test_registry_requires_every_active_key_including_new_tracked_experiments():
    from types import SimpleNamespace
    from unittest.mock import Mock

    from openjii.question_answer_backfill import _check_registry

    value = manifest()
    experiment_id = next(iter(value["experiments"]))
    newer = "82237162-f942-4ac6-8f1c-02d26d3b3e2b"
    spark = Mock()
    spark.sql.return_value.collect.return_value = [SimpleNamespace(experiment_id=newer)]
    _check_registry(spark, value, lambda ids: {experiment_id: ["height"], newer: []})
    assert not _check_registry(spark, value, lambda ids: {experiment_id: [], newer: []}, require_active=False)
    with pytest.raises(ValueError, match="differ"):
        _check_registry(spark, value, lambda ids: {experiment_id: ["other"], newer: []}, require_active=False)
    with pytest.raises(ValueError, match="differ"):
        _check_registry(spark, value, lambda ids: {experiment_id: ["height"], newer: ["new_number"]})
    with pytest.raises(ValueError, match="cover every"):
        _check_registry(spark, value, lambda ids: {experiment_id: ["height"]})
    with pytest.raises(ValueError, match="differ"):
        _check_registry(spark, value, lambda ids: {experiment_id: [], newer: []})


def test_history_accepts_maintenance_and_fingerprinted_updates_but_refuses_appends_or_replacement():
    from types import SimpleNamespace
    from unittest.mock import Mock

    from openjii.question_answer_backfill import _check_history

    value = manifest()
    target = value["tables"]["raw_data"]
    spark = Mock()
    spark.table.return_value.columns = ["questions_data", "questions_original_data"]
    detail = SimpleNamespace(id=target["table_id"])
    history = [
        SimpleNamespace(version=4, operation="STREAMING UPDATE", userMetadata=None),
        SimpleNamespace(version=5, operation="UPDATE", userMetadata="fingerprint"),
        SimpleNamespace(version=6, operation="OPTIMIZE", userMetadata=None),
    ]
    spark.sql.return_value.first.return_value = detail
    spark.sql.return_value.collect.return_value = history
    _check_history(spark, target, "fingerprint")
    history.append(SimpleNamespace(version=7, operation="STREAMING UPDATE", userMetadata=None))
    with pytest.raises(ValueError, match="Gold changed"):
        _check_history(spark, target, "fingerprint")
    detail.id = str(uuid4())
    with pytest.raises(ValueError, match="identity"):
        _check_history(spark, target, "fingerprint")


@pytest.mark.spark
def test_dry_run_requires_a_recovery_copy_even_when_values_are_already_typed(spark):
    database = "qa_question_original_" + uuid4().hex[:8]
    spark.sql(f"CREATE DATABASE {database}")
    try:
        experiment_id = next(iter(manifest()["experiments"]))
        spark.sql(f"""CREATE VIEW {database}.experiment_raw_data AS
            SELECT '{experiment_id}' experiment_id, parse_json('{{"height":12.5}}') questions_data,
                   cast(NULL AS VARIANT) questions_original_data""")
        report = _report(
            spark, {"name": f"spark_catalog.{database}.experiment_raw_data"}, experiment_id, ["height"]
        )
        assert report["changed_rows"] == 1
        assert report["invalid_numbers"] == 0
    finally:
        spark.sql(f"DROP DATABASE {database} CASCADE")


@pytest.mark.spark
def test_audit_uses_originals_to_detect_live_invalid_values_and_missing_conversions(spark):
    database = "qa_question_audit_" + uuid4().hex[:8]
    spark.sql(f"CREATE DATABASE {database}")
    try:
        experiment_id = next(iter(manifest()["experiments"]))
        spark.sql(f"""CREATE VIEW {database}.experiment_raw_data AS
            SELECT '{experiment_id}' experiment_id, parse_json('{{"height":null}}') questions_data,
                   parse_json(original) questions_original_data
            FROM VALUES ('{{"height":"NaN"}}'), ('{{"height":"12.50"}}') t(original)""")
        report = _report(
            spark, {"name": f"spark_catalog.{database}.experiment_raw_data"}, experiment_id, ["height"]
        )
        assert report["changed_rows"] == 1
        assert report["invalid_numbers"] == 1
    finally:
        spark.sql(f"DROP DATABASE {database} CASCADE")


def test_invalid_allowances_are_reviewed_per_key_and_new_bad_answers_still_fail_the_gate():
    from openjii.question_answer_backfill import _invalid_matches

    value = manifest()
    experiment_id = next(iter(value["experiments"]))
    original = validate_manifest(value)
    value["invalid_answers"] = {"raw_data": {experiment_id: {"height": 1}}}
    assert validate_manifest(value) != original
    assert _invalid_matches(
        value, "raw_data", {"experiment_id": experiment_id, "invalid_by_key": {"height": 1}}
    )
    assert not _invalid_matches(
        value, "raw_data", {"experiment_id": experiment_id, "invalid_by_key": {"height": 2}}
    )
    assert not _invalid_matches(
        value, "macro_data", {"experiment_id": experiment_id, "invalid_by_key": {"height": 1}}
    )
    value["invalid_answers"]["raw_data"][experiment_id] = {"unapproved": 1}
    with pytest.raises(ValueError, match="approved key"):
        validate_manifest(value)
