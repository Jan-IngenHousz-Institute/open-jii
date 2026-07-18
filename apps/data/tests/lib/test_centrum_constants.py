"""Smoke tests for the spark-free openjii.centrum surface (constants + exports)."""

from __future__ import annotations

import openjii.centrum as centrum


def test_upload_constants_exported() -> None:
    assert centrum.RAW_UPLOADED_DATA_TABLE == "raw_uploaded_data"
    assert centrum.EXPERIMENT_UPLOADED_DATA_TABLE == "experiment_uploaded_data"
    assert centrum.ENRICHED_UPLOADED_DATA_VIEW == "enriched_experiment_uploaded_data"
    for name in (
        "RAW_UPLOADED_DATA_TABLE",
        "EXPERIMENT_UPLOADED_DATA_TABLE",
        "ENRICHED_UPLOADED_DATA_VIEW",
    ):
        assert name in centrum.__all__


def test_ambyte_constants_removed() -> None:
    for name in ("RAW_AMBYTE_TABLE", "ENRICHED_RAW_AMBYTE_DATA_VIEW"):
        assert not hasattr(centrum, name)
        assert name not in centrum.__all__


def test_runtime_not_reexported() -> None:
    # runtime.py reads spark.conf eagerly; keeping it out of the package __init__
    # is what makes `import openjii.centrum` safe without an active Spark session.
    assert "runtime" not in centrum.__all__
