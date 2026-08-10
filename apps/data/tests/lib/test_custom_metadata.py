"""Focused tests for custom metadata match-target SQL generation."""

from enrich.custom_metadata import _ORDERED_METADATA_SQL, _match_value_sql, _merge_sql


def test_metadata_blobs_are_ordered_by_persisted_creation_order() -> None:
    sql = " ".join(_ORDERED_METADATA_SQL.split())

    assert "array_sort( collect_list(named_struct(" in sql
    assert "'created_at', created_at" in sql
    assert "'metadata_id', metadata_id" in sql
    assert "'json', to_json(metadata)" in sql
    assert "item -> parse_json(item.json)" in sql


def test_question_target_reads_questions_data() -> None:
    sql = _match_value_sql(["questions_data"])

    assert "variant_get(questions_data" in sql
    assert "CAST(`device_id` AS STRING)" not in sql


def test_device_target_reads_existing_measurement_column() -> None:
    sql = _match_value_sql(["questions_data", "device_id"])

    assert "= 'column:device_id' THEN CAST(`device_id` AS STRING)" in sql
    assert "variant_get(questions_data" in sql


def test_missing_question_namespace_resolves_question_targets_to_null() -> None:
    sql = _match_value_sql(["device_id"])

    assert "ELSE CAST(NULL AS STRING)" in sql


def test_unsupported_column_target_does_not_fall_back_to_question_data() -> None:
    sql = _match_value_sql(["questions_data"])

    prefix_guard = "LIKE 'column:%' THEN CAST(NULL AS STRING)"
    assert prefix_guard in sql
    assert sql.index(prefix_guard) < sql.index("ELSE variant_get(questions_data")


def test_merge_uses_ansi_safe_first_match() -> None:
    sql = _merge_sql(["questions_data", "device_id"])

    assert "try_element_at(" in sql
    assert "filter(" in sql
    assert "column:device_id" in sql


def test_later_blob_explicitly_replaces_repeated_keys() -> None:
    sql = " ".join(_merge_sql(["questions_data"]).split())

    assert "map_filter( cast(acc AS MAP<STRING, VARIANT>)" in sql
    assert "map_keys(cast(x AS MAP<STRING, VARIANT>))" in sql
