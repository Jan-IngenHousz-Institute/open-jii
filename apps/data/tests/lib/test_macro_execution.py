import pandas as pd
from enrich.macro_execution import _add_workbook_metadata


def test_add_workbook_metadata_carries_snapshot_and_context() -> None:
    item: dict = {"id": "row-1", "macro_id": "macro-1", "data": "{}"}

    _add_workbook_metadata(
        item,
        {
            "workbook_version_id": "version-1",
            "macro_context": '{"baseline":{"value":3}}',
        },
    )

    assert item["workbook_version_id"] == "version-1"
    assert item["context"] == '{"baseline":{"value":3}}'


def test_add_workbook_metadata_omits_null_legacy_fields() -> None:
    item: dict = {"id": "row-1", "macro_id": "macro-1", "data": "{}"}

    _add_workbook_metadata(
        item,
        {"workbook_version_id": None, "macro_context": pd.NA},
    )

    assert "workbook_version_id" not in item
    assert "context" not in item
