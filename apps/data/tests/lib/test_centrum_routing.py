"""Control records never enter the measurement side of bronze routing."""

from __future__ import annotations

import pytest
from openjii.centrum.routing import measurement_records, workbook_control_records


@pytest.mark.spark
def test_workbook_controls_are_isolated_from_measurements(spark) -> None:
    records = spark.createDataFrame(
        [
            ("measurement-legacy", None),
            ("measurement-future", "some_other_record"),
            ("attempt-1", "workbook_run_complete"),
        ],
        ["id", "record_kind"],
    )

    assert [row.id for row in measurement_records(records).collect()] == [
        "measurement-legacy",
        "measurement-future",
    ]
    assert [row.id for row in workbook_control_records(records).collect()] == ["attempt-1"]
