"""Reviewed in-place gold rewrite. Dry run is the default; ingestion history is never rewritten."""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Callable
from uuid import UUID

from .number_answers import invalid_question_answer_count_expression, typed_question_answers_expression

_IDENTIFIER = re.compile(r"[A-Za-z_][A-Za-z0-9_]*\Z")
_KEY = re.compile(r"[a-z_][a-z0-9_]*\Z")
_MAINTENANCE = {"OPTIMIZE", "VACUUM START", "VACUUM END", "ANALYZE"}
_METADATA = "spark.databricks.delta.commitInfo.userMetadata"


def _table(name: str) -> str:
    if (
        not isinstance(name, str)
        or len(name.split(".")) != 3
        or not all(_IDENTIFIER.fullmatch(part) for part in name.split("."))
    ):
        raise ValueError("Use a three-part catalog.schema.table name")
    return ".".join(f"`{part}`" for part in name.split("."))


def validate_manifest(manifest: dict) -> str:
    if (
        manifest.get("version") != 1
        or not isinstance(manifest.get("evidence"), str)
        or not manifest["evidence"].strip()
    ):
        raise ValueError("A version 1 manifest needs its reviewed evidence reference")
    if set(manifest.get("tables", {})) != {"raw_data", "macro_data"}:
        raise ValueError("Both raw_data and macro_data targets are required")
    names = []
    for role, target in manifest["tables"].items():
        _table(target["name"])
        _table(target["backup"])
        if target["name"].split(".")[-1] != f"experiment_{role}":
            raise ValueError("Only the raw and macro gold tables can be rewritten")
        if type(target.get("source_version")) is not int or target["source_version"] < 0:
            raise ValueError("Record each table's nonnegative Delta source_version")
        if str(UUID(target.get("table_id", ""))) != target["table_id"]:
            raise ValueError("Record each source Delta table's immutable table_id")
        names.extend([target["name"], target["backup"]])
    if len(set(name.lower() for name in names)) != 4:
        raise ValueError("Targets and backups must be four distinct tables")
    experiments = manifest.get("experiments")
    if not isinstance(experiments, dict) or not experiments:
        raise ValueError("Provide the reviewed experiment-to-numeric-key mapping")
    for experiment_id, keys in experiments.items():
        if str(UUID(experiment_id)) != experiment_id:
            raise ValueError("Use canonical experiment UUIDs")
        if (
            not isinstance(keys, list)
            or not keys
            or any(not isinstance(key, str) or not _KEY.fullmatch(key) for key in keys)
        ):
            raise ValueError("Numeric keys must be nonempty canonical question keys")
        if len(set(keys)) != len(keys):
            raise ValueError("Numeric keys must not repeat")
    invalid = manifest.get("invalid_answers", {})
    if not isinstance(invalid, dict) or not set(invalid).issubset(manifest["tables"]):
        raise ValueError("Reviewed invalid counts must name only manifest table roles")
    for allowances in invalid.values():
        if not isinstance(allowances, dict) or not set(allowances).issubset(experiments):
            raise ValueError("Reviewed invalid counts must name only manifest experiments")
        for experiment_id, counts in allowances.items():
            if (
                not isinstance(counts, dict)
                or not set(counts).issubset(experiments[experiment_id])
                or any(type(count) is not int or count < 0 for count in counts.values())
            ):
                raise ValueError("Reviewed invalid counts must be nonnegative counts per approved key")
    return hashlib.sha256(json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _keys(keys: list[str]) -> str:
    return "array(" + ", ".join(f"'{key}'" for key in keys) + ")"


def _check_identity(spark, target: dict) -> None:
    detail = spark.sql(f"DESCRIBE DETAIL {_table(target['name'])}").first()
    if detail.id != target["table_id"]:
        raise ValueError("Source table identity changed")
    if "questions_original_data" not in spark.table(target["name"]).columns:
        raise ValueError("Deploy the additive questions_original_data column before the backfill")


def _check_history(spark, target: dict, fingerprint: str) -> None:
    _check_identity(spark, target)
    history = spark.sql(f"DESCRIBE HISTORY {_table(target['name'])}").collect()
    latest = max(row.version for row in history)
    source = target["source_version"]
    if latest < source or not any(row.version == source for row in history):
        raise ValueError("The reviewed Delta source version is unavailable")
    if any(
        row.userMetadata != fingerprint and row.operation not in _MAINTENANCE
        for row in history
        if row.version > source
    ):
        raise ValueError("Gold changed since the reviewed source version; reconcile the manifest")


def _report(
    spark, target: dict, experiment_id: str, keys: list[str], allowed_invalid: dict | None = None
) -> dict:
    approved = _keys(keys)
    converted = typed_question_answers_expression(
        "coalesce(questions_original_data, questions_data)", approved
    )
    invalid = invalid_question_answer_count_expression(
        "coalesce(questions_original_data, questions_data)", "_typed", approved
    )
    per_key = ", ".join(
        f"coalesce(sum({invalid_question_answer_count_expression('coalesce(questions_original_data, questions_data)', '_typed', _keys([key]))}), 0) AS invalid_{index}"
        for index, key in enumerate(keys)
    )
    row = spark.sql(f"""SELECT count(*) AS rows,
        count_if((questions_original_data IS NULL AND questions_data IS NOT NULL)
            OR NOT (to_json(questions_data) <=> to_json(_typed))) AS changed_rows,
        coalesce(sum({invalid}), 0) AS invalid_numbers, {per_key}
        FROM (SELECT questions_data, questions_original_data, {converted} AS _typed FROM {_table(target["name"])}
              WHERE experiment_id = '{experiment_id}')""").first()
    values = row.asDict()
    by_key = {key: values.pop(f"invalid_{index}") for index, key in enumerate(keys)}
    allowed = allowed_invalid or {}
    return {
        "experiment_id": experiment_id,
        **values,
        "invalid_by_key": {key: count for key, count in by_key.items() if count},
        "new_invalid_numbers": sum(max(count - allowed.get(key, 0), 0) for key, count in by_key.items()),
    }


def _allowances(manifest: dict, role: str, experiment_id: str) -> dict:
    return manifest.get("invalid_answers", {}).get(role, {}).get(experiment_id, {})


def _invalid_matches(manifest: dict, role: str, row: dict) -> bool:
    expected = {
        key: count for key, count in _allowances(manifest, role, row["experiment_id"]).items() if count
    }
    return row["invalid_by_key"] == expected


def _check_backup(spark, target: dict, fingerprint: str) -> None:
    backup = _table(target["backup"])
    properties = {row.key: row.value for row in spark.sql(f"SHOW TBLPROPERTIES {backup}").collect()}
    if (
        properties.get("openjii.questionBackfill") != fingerprint
        or properties.get("openjii.sourceVersion") != str(target["source_version"])
        or properties.get("openjii.sourceTable") != target["name"]
        or properties.get("openjii.sourceTableId") != target["table_id"]
    ):
        raise ValueError("An existing backup does not belong to this manifest and source identity")


def _check_registry(spark, manifest: dict, lookup: Callable, *, require_active: bool = True) -> bool:
    ids = set(manifest["experiments"])
    for target in manifest["tables"].values():
        rows = spark.sql(
            f"SELECT DISTINCT experiment_id FROM {_table(target['name'])} WHERE questions_data IS NOT NULL"
        ).collect()
        ids.update(row.experiment_id for row in rows)
    for value in ids:
        if not isinstance(value, str) or str(UUID(value)) != value:
            raise ValueError("Malformed historical experiment IDs require review")
    actual = lookup(sorted(ids))
    if set(actual) != ids:
        raise ValueError("Registry lookup must cover every stored experiment")
    active = {key: sorted(value) for key, value in actual.items() if value}
    expected = {key: sorted(value) for key, value in manifest["experiments"].items()}
    if (
        active != expected
        if require_active
        else any(not set(keys).issubset(expected.get(experiment, [])) for experiment, keys in active.items())
    ):
        raise ValueError(
            "Manifest keys differ from the active registry; reconcile all tracked and historical experiments"
        )
    return active == expected


def audit_backfill(spark, manifest: dict, *, registry_lookup: Callable) -> dict:
    """Check current rows after resume, without treating new appends as a migration retry."""
    fingerprint = validate_manifest(manifest)
    for target in manifest["tables"].values():
        _check_identity(spark, target)
    _check_registry(spark, manifest, registry_lookup)
    return {
        "fingerprint": fingerprint,
        "raw_macro_mismatches": spark.sql(f"""SELECT count(*) n
            FROM {_table(manifest["tables"]["macro_data"]["name"])} m
            WHERE m.experiment_id IN ({", ".join(f"'{value}'" for value in sorted(manifest["experiments"]))})
              AND NOT EXISTS (SELECT 1 FROM {_table(manifest["tables"]["raw_data"]["name"])} r
                  WHERE r.experiment_id = m.experiment_id AND r.id = m.raw_id
                    AND to_json(r.questions_data) <=> to_json(m.questions_data))""")
        .first()
        .n,
        "tables": {
            role: [
                _report(spark, target, experiment_id, keys, _allowances(manifest, role, experiment_id))
                for experiment_id, keys in sorted(manifest["experiments"].items())
            ]
            for role, target in manifest["tables"].items()
        },
    }


def _commit_metadata(spark, fingerprint: str):
    try:
        previous = spark.conf.get(_METADATA, None)
        spark.conf.set(_METADATA, fingerprint)
        return previous
    except Exception as error:
        raise ValueError(
            "Apply and rollback require standard-access classic Databricks compute with Delta commit metadata support; serverless supports dry run and audit only"
        ) from error


def _restore_metadata(spark, previous):
    if previous is None:
        spark.conf.unset(_METADATA)
    else:
        spark.conf.set(_METADATA, previous)


def rollback_backfill(
    spark,
    manifest: dict,
    *,
    reviewed_fingerprint: str,
    pipelines_paused: bool,
    registry_lookup: Callable,
    after_resume: bool = False,
) -> dict:
    """Restore per-row originals; after_resume explicitly permits new appends without deleting them."""
    fingerprint = validate_manifest(manifest)
    if reviewed_fingerprint != fingerprint or not pipelines_paused:
        raise ValueError("Rollback requires the reviewed fingerprint and paused pipelines")
    active = registry_lookup(sorted(manifest["experiments"]))
    if set(active) != set(manifest["experiments"]) or any(active.values()):
        raise ValueError("Disable numeric activation under the experiment lock before rollback")
    ids = ", ".join(f"'{value}'" for value in sorted(manifest["experiments"]))
    for target in manifest["tables"].values():
        _check_identity(spark, target)
        if not after_resume:
            _check_history(spark, target, fingerprint)
        _check_backup(spark, target, fingerprint)
        missing = (
            spark.sql(f"""SELECT count(*) AS n FROM {_table(target["name"])}
            WHERE experiment_id IN ({ids}) AND questions_data IS NOT NULL
              AND questions_original_data IS NULL""")
            .first()
            .n
        )
        if missing:
            raise ValueError(
                "Original answers are missing; keep pipelines paused and recover from the backup"
            )
    previous = _commit_metadata(spark, fingerprint)
    try:
        for target in manifest["tables"].values():
            _check_identity(spark, target)
            if not after_resume:
                _check_history(spark, target, fingerprint)
            spark.sql(f"""UPDATE {_table(target["name"])}
                SET questions_data = questions_original_data
                WHERE experiment_id IN ({ids})
                  AND NOT (to_json(questions_data) <=> to_json(questions_original_data))""")
            mismatch = (
                spark.sql(f"""SELECT count(*) AS n FROM {_table(target["name"])}
                WHERE experiment_id IN ({ids})
                  AND NOT (to_json(questions_data) <=> to_json(questions_original_data))""")
                .first()
                .n
            )
            if mismatch:
                raise ValueError("Rollback did not restore every original answer; keep pipelines paused")
        return {
            "fingerprint": fingerprint,
            "restored": True,
            "after_resume": after_resume,
            "required_actions": [
                "Refresh and verify schema summaries and serving-store postimages before resuming"
            ],
        }
    finally:
        _restore_metadata(spark, previous)


def run_backfill(
    spark,
    manifest: dict,
    *,
    registry_lookup: Callable | None = None,
    apply: bool = False,
    reviewed_fingerprint: str = "",
    pipelines_paused: bool = False,
    macro_stream_drained: bool = False,
) -> dict:
    fingerprint = validate_manifest(manifest)
    if apply and (reviewed_fingerprint != fingerprint or not pipelines_paused or not macro_stream_drained):
        raise ValueError(
            "Apply requires the reviewed dry-run fingerprint, paused pipelines and a drained macro stream"
        )
    if registry_lookup is None:
        raise ValueError("A live approved-key registry lookup is required")
    registry_matches = _check_registry(spark, manifest, registry_lookup, require_active=apply)
    report = {
        "fingerprint": fingerprint,
        "applied": False,
        "registry_matches": registry_matches,
        "ready_to_resume": False,
        "tables": {},
        "required_actions": [
            "Selectively full-refresh experiment_raw_data_schemas and experiment_macro_data_schemas, then refresh experiment_table_metadata",
            "Verify schema-summary keys match current gold and numeric column metadata matches the registry",
            "Verify serving-store CDF postimages and row parity within retention",
            "Resume ingestion with configuration edits still paused; run audit_backfill and require zero changed rows, zero new_invalid_numbers and per-key counts equal to reviewed invalid_answers before signoff",
        ],
    }
    for role, target in manifest["tables"].items():
        _check_history(spark, target, fingerprint)
        report["tables"][role] = [
            _report(spark, target, experiment_id, keys, _allowances(manifest, role, experiment_id))
            for experiment_id, keys in sorted(manifest["experiments"].items())
        ]
    if not apply:
        return report
    if any(
        not _invalid_matches(manifest, role, row) for role, rows in report["tables"].items() for row in rows
    ):
        raise ValueError(
            "Historical invalid counts differ from the reviewed per-key counts; review before rewriting or activation"
        )
    previous_metadata = _commit_metadata(spark, fingerprint)
    try:
        # Streaming tables cannot CLONE or RESTORE. Keep independent snapshots before either rewrite.
        for target in manifest["tables"].values():
            _check_history(spark, target, fingerprint)
            backup = _table(target["backup"])
            if spark.catalog.tableExists(target["backup"]):
                _check_backup(spark, target, fingerprint)
            else:
                history = spark.sql(f"DESCRIBE HISTORY {_table(target['name'])}").collect()
                if any(
                    row.userMetadata == fingerprint and row.operation == "UPDATE"
                    for row in history
                    if row.version > target["source_version"]
                ):
                    raise ValueError(
                        "A backup is missing after a partial rewrite; recover it before retrying"
                    )
                ids = ", ".join(f"'{value}'" for value in sorted(manifest["experiments"]))
                spark.sql(f"""CREATE TABLE {backup} USING DELTA TBLPROPERTIES (
                    'openjii.questionBackfill' = '{fingerprint}',
                    'openjii.sourceTable' = '{target["name"]}',
                    'openjii.sourceTableId' = '{target["table_id"]}',
                    'openjii.sourceVersion' = '{target["source_version"]}') AS
                    SELECT * FROM {_table(target["name"])} WHERE experiment_id IN ({ids})""")
                _check_backup(spark, target, fingerprint)
            ids = ", ".join(f"'{value}'" for value in sorted(manifest["experiments"]))
            source_count = (
                spark.sql(f"SELECT count(*) n FROM {_table(target['name'])} WHERE experiment_id IN ({ids})")
                .first()
                .n
            )
            backup_count = spark.sql(f"SELECT count(*) n FROM {backup}").first().n
            if source_count != backup_count:
                raise ValueError("Backup row count differs from the paused source; recover before rewriting")
        for role, target in manifest["tables"].items():
            changed = {row["experiment_id"]: row["changed_rows"] for row in report["tables"][role]}
            for experiment_id, keys in sorted(manifest["experiments"].items()):
                if not changed[experiment_id]:
                    continue
                _check_history(spark, target, fingerprint)
                converted = typed_question_answers_expression(
                    "coalesce(questions_original_data, questions_data)", _keys(keys)
                )
                spark.sql(f"""UPDATE {_table(target["name"])} SET questions_original_data = coalesce(questions_original_data, questions_data),
                    questions_data = {converted}
                    WHERE experiment_id = '{experiment_id}'
                      AND ((questions_original_data IS NULL AND questions_data IS NOT NULL)
                           OR NOT (to_json(questions_data) <=> to_json({converted})))""")
        _check_registry(spark, manifest, registry_lookup)
        for role, target in manifest["tables"].items():
            _check_history(spark, target, fingerprint)
            after = [
                _report(spark, target, experiment_id, keys, _allowances(manifest, role, experiment_id))
                for experiment_id, keys in sorted(manifest["experiments"].items())
            ]
            before = report["tables"][role]
            if any(row["changed_rows"] or not _invalid_matches(manifest, role, row) for row in after) or any(
                old["rows"] != new["rows"] for old, new in zip(before, after, strict=True)
            ):
                raise ValueError("Post-rewrite counts or values differ; keep activation paused")
            report["tables"][role] = after
        report["applied"] = True
        return report
    finally:
        _restore_metadata(spark, previous_metadata)
