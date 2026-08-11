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


def test_unwrapped_gold_row_reaches_the_macro_as_the_same_measurement() -> None:
    """Gold stores the measurement object for new writes; history keeps the array.

    Both must hand the macro the same value. A root array becomes a `sample`
    envelope, from which the backend's normalizer selects element 0; an object is
    passed directly, which is that same element. The envelope key must not be
    added to an object, or the normalizer would project a level too deep.
    """
    measurement = {"protocol_id": "p1", "set": [{"phi2": 0.7}]}

    from_history = json.loads(_serialize_macro_data([measurement]))
    from_new_write = json.loads(_serialize_macro_data(measurement))

    assert from_history == {"sample": [measurement]}
    assert from_new_write == measurement
    assert from_history["sample"][0] == from_new_write


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
