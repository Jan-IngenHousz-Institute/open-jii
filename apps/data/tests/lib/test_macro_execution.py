import json

import pandas as pd
from enrich import macro_execution
from enrich.macro_execution import _add_workbook_metadata, _serialize_macro_data
from pytest import MonkeyPatch


def test_serialize_macro_data_wraps_native_legacy_root_array() -> None:
    data = [{"phi2": 0.7}, {"phi2": 0.8}]

    assert json.loads(_serialize_macro_data(data)) == {"sample": data}


def test_serialize_macro_data_wraps_serialized_legacy_root_array() -> None:
    data = [{"phi2": 0.7}]

    assert json.loads(_serialize_macro_data(json.dumps(data))) == {"sample": data}


def test_serialize_macro_data_wraps_empty_legacy_root_array() -> None:
    assert json.loads(_serialize_macro_data([])) == {"sample": []}


def test_serialize_macro_data_keeps_direct_object_shape() -> None:
    data = {"phi2": 0.7}

    assert json.loads(_serialize_macro_data(data)) == data


def test_serialize_macro_data_keeps_native_and_serialized_scalar_shape() -> None:
    assert _serialize_macro_data(42) == "42"
    assert _serialize_macro_data("42") == "42"


def test_serialize_macro_data_wraps_variant_root_array(monkeypatch: MonkeyPatch) -> None:
    class FakeVariantVal:
        def toJson(self) -> str:
            return '[{"phi2":0.7}]'

    monkeypatch.setattr(macro_execution, "_VariantVal", FakeVariantVal)

    assert json.loads(_serialize_macro_data(FakeVariantVal())) == {"sample": [{"phi2": 0.7}]}


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
