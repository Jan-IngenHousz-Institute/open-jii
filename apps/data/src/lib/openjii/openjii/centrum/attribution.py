"""Topic and payload attribution for the silver layer.

Two ingest topic shapes are live at once (``asyncapi.yaml``):

* lean, 7 segments -- ``experiment/data_ingest/v1/{experimentId}/{sensorType}/{sensorVersion}/{sensorId}``
* legacy, 8 segments -- the same plus a trailing ``{protocolId}``, still published
  by fielded mobile builds and kept as a transitional channel.

``sensorType`` sits at segment 5 in both, which is what ``sensor_family`` reads.
Protocol attribution differs: the legacy topic carries it in segment 8, and on
the lean topic the payload is the only source, so a v3 measurement object's
``protocol.id`` fills the column (contract §3, §13).

These are Column expressions rather than inline strings in the pipeline notebook
so the segment arithmetic can be tested against real topics without a warehouse.
"""

from __future__ import annotations

from pyspark.sql import Column
from pyspark.sql import functions as F

from ..trace.contract import TRACE_SCHEMA_FAMILY

# experiment / data_ingest / v1 / {experimentId} / {sensorType} / ...
_SENSOR_TYPE_SEGMENT = 5
_LEGACY_SEGMENT_COUNT = 8
_LEGACY_PROTOCOL_SEGMENT = 8


def sensor_family(topic: Column) -> Column:
    """The sensor family (topic segment 5), NULL on a malformed or absent topic."""
    segments = F.split(topic, "/")
    return F.when(
        F.size(segments) >= _SENSOR_TYPE_SEGMENT,
        F.element_at(segments, _SENSOR_TYPE_SEGMENT),
    )


def payload_schema_tag(sample: Column) -> Column:
    """The ``schema`` tag of the measurement object, wrapped or not.

    Reads the JSON text rather than a VARIANT: silver runs before gold's
    ``parse_json``, and this has to work on the decompressed sample string.
    """
    return F.coalesce(
        F.get_json_object(sample, "$[0].schema"),
        F.get_json_object(sample, "$.schema"),
    )


def payload_protocol_id(sample: Column) -> Column:
    """The registered protocol id the payload claims, for v3 traces only.

    Restricted to the ``ambit.trace/*`` family on purpose: it is the only schema
    the contract gives a ``protocol.id``, and reading the key off any payload
    would start attributing rows from a field nobody has promised to fill.
    """
    return F.when(
        payload_schema_tag(sample).startswith(TRACE_SCHEMA_FAMILY),
        F.coalesce(
            F.get_json_object(sample, "$[0].protocol.id"),
            F.get_json_object(sample, "$.protocol.id"),
        ),
    )


def protocol_id(topic: Column, sample: Column) -> Column:
    """Resolved protocol attribution for a row.

    The legacy topic's trailing segment wins where it exists -- that is the
    attribution the publisher chose, and mobile still sends it. Everything else
    falls back to the payload, which is what the lean topic leaves as the only
    source.
    """
    segments = F.split(topic, "/")
    return F.when(
        F.size(segments) == _LEGACY_SEGMENT_COUNT,
        F.element_at(segments, _LEGACY_PROTOCOL_SEGMENT),
    ).otherwise(payload_protocol_id(sample))
