"""Silver-layer topic and payload attribution.

Two ingest topic shapes are live at once, so the segment arithmetic is worth
pinning: getting it wrong is what put the sensor family in the protocol column
before ``feat/lean-ingest-topic`` fixed it.
"""

from __future__ import annotations

import json

import pytest

LEAN = "experiment/data_ingest/v1/exp123/ambit/1/AMBYTE_10003B722244"
LEGACY = "experiment/data_ingest/v1/exp123/multispeq/1.0/device-9/proto-42"

V3_SAMPLE = json.dumps(
    [
        {
            "schema": "ambit.trace/3",
            "protocol": {"id": "payload-protocol", "cmd": "arrun 1,0"},
            "series": {},
        }
    ]
)
V3_UNWRAPPED_SAMPLE = json.dumps(
    {"schema": "ambit.trace/3", "protocol": {"id": "payload-protocol"}, "series": {}}
)
V2_SAMPLE = json.dumps([{"v": 2, "cmd_raw": "arrun 1,0", "data": {"s_630": [1]}}])
MULTISPEQ_SAMPLE = json.dumps([{"protocol_id": "in-the-payload-but-not-a-trace", "set": []}])


@pytest.fixture
def attribution():
    from openjii.centrum import attribution as module

    return module


@pytest.mark.spark
class TestAttribution:
    def _resolve(self, spark, attribution, topic, sample):
        from pyspark.sql import functions as F

        df = spark.createDataFrame([(topic, sample)], schema="topic STRING, sample STRING").select(
            attribution.sensor_family(F.col("topic")).alias("sensor_family"),
            attribution.protocol_id(F.col("topic"), F.col("sample")).alias("protocol_id"),
            attribution.payload_protocol_id(F.col("sample")).alias("payload_protocol_id"),
        )
        return df.collect()[0]

    def test_lean_topic_reads_the_payload(self, spark, attribution) -> None:
        row = self._resolve(spark, attribution, LEAN, V3_SAMPLE)
        assert row["sensor_family"] == "ambit"
        assert row["protocol_id"] == "payload-protocol"

    def test_legacy_topic_segment_wins(self, spark, attribution) -> None:
        # Petar's fix: the trailing segment of the 8-segment topic, and the
        # publisher's own attribution stays authoritative for that shape.
        row = self._resolve(spark, attribution, LEGACY, V3_SAMPLE)
        assert row["sensor_family"] == "multispeq"
        assert row["protocol_id"] == "proto-42"

    def test_unwrapped_payload_is_read_too(self, spark, attribution) -> None:
        row = self._resolve(spark, attribution, LEAN, V3_UNWRAPPED_SAMPLE)
        assert row["protocol_id"] == "payload-protocol"

    def test_v2_payload_on_the_lean_topic_has_no_attribution(self, spark, attribution) -> None:
        # v2 has no protocol.id at all, and metadata.protocol is a free-form
        # label, not a registered id.
        row = self._resolve(spark, attribution, LEAN, V2_SAMPLE)
        assert row["protocol_id"] is None

    def test_non_trace_payload_keys_are_not_read(self, spark, attribution) -> None:
        # Only ambit.trace/* is promised to carry protocol.id; a top-level
        # protocol_id on some other payload must not become attribution.
        row = self._resolve(spark, attribution, LEAN, MULTISPEQ_SAMPLE)
        assert row["payload_protocol_id"] is None
        assert row["protocol_id"] is None

    def test_missing_topic_and_sample(self, spark, attribution) -> None:
        row = self._resolve(spark, attribution, None, None)
        assert row["sensor_family"] is None
        assert row["protocol_id"] is None

    def test_short_topic_yields_no_family(self, spark, attribution) -> None:
        row = self._resolve(spark, attribution, "experiment/data_ingest/v1/exp123", V3_SAMPLE)
        assert row["sensor_family"] is None

    def test_family_position_is_the_same_in_both_shapes(self, spark, attribution) -> None:
        lean = self._resolve(spark, attribution, LEAN, V3_SAMPLE)["sensor_family"]
        legacy = self._resolve(spark, attribution, LEAN + "/proto-42", V3_SAMPLE)["sensor_family"]
        assert lean == legacy == "ambit"
