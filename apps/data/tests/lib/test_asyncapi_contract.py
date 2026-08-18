"""Drift check: the AsyncAPI ingest message must mirror the pipeline schema.

The published contract (asyncapi.yaml) tells device integrators what payload
fields exist; the pipeline's sensor_schema decides what actually parses. The
two live in different files and drift silently, so this test pins them to
each other. CI coverage comes from the data test gate: asyncapi.yaml is
declared a turbo input of this package, so contract-only changes still mark
`data` affected and run this suite.
"""

from pathlib import Path

import yaml
from openjii.centrum import annotation_schema, macro_schema, question_schema, sensor_schema

REPO_ROOT = Path(__file__).resolve().parents[4]

# Injected into the stored envelope by the broker rule; never sent by publishers.
RULE_INJECTED = {"topic"}

# Payload fields bronze extracts as top-level columns instead of through
# sensor_schema; part of the publish contract all the same.
BRONZE_TOP_LEVEL = {"macro_context", "workbook_version_id"}


def _message_payload() -> dict:
    doc = yaml.safe_load((REPO_ROOT / "asyncapi.yaml").read_text())
    return doc["components"]["messages"]["ExperimentDataMessage"]["payload"]


def test_contract_fields_mirror_the_pipeline_schema():
    contract = set(_message_payload()["properties"])
    pipeline = (set(sensor_schema.fieldNames()) - RULE_INJECTED) | BRONZE_TOP_LEVEL

    assert contract == pipeline, (
        f"asyncapi.yaml and sensor_schema drifted. "
        f"contract-only: {sorted(contract - pipeline)}, "
        f"pipeline-only: {sorted(pipeline - contract)}"
    )


def test_contract_item_shapes_mirror_the_nested_schemas():
    properties = _message_payload()["properties"]

    for field, schema in [
        ("macros", macro_schema),
        ("questions", question_schema),
        ("annotations", annotation_schema),
    ]:
        contract_items = set(properties[field]["items"]["properties"])
        assert contract_items == set(schema.fieldNames()), (
            f"asyncapi.yaml `{field}` items drifted from the pipeline schema"
        )


def test_both_ingest_channels_carry_the_same_message():
    doc = yaml.safe_load((REPO_ROOT / "asyncapi.yaml").read_text())
    ingest_channels = [
        channel for name, channel in doc["channels"].items() if name.startswith("experiment/data_ingest/")
    ]

    assert len(ingest_channels) == 2
    for channel in ingest_channels:
        assert channel["subscribe"]["message"]["$ref"] == "#/components/messages/ExperimentDataMessage"
