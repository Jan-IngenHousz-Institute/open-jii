"""Shared payload fixtures for the v3 contract.

The same rows are used twice: the local test-suite runs them through the Python
reference in :mod:`openjii.trace`, and the ``centrum_v3_smoke`` task runs them
through the deployed SQL. One set of inputs and one set of expectations is what
keeps the two implementations from drifting.

Each fixture is ``{name, generation, note, row, sample, expect}``: ``row`` is the
gold ``experiment_raw_data`` envelope, ``sample`` the wire value (still wrapped
in the firmware's one-element array), ``expect`` the hand-computed contract
answer.
"""

from __future__ import annotations

import json
from importlib import resources
from typing import Any

TRACES = "traces.json"
TELEMETRY = "telemetry.json"
DEVICES = "devices.json"


def load(filename: str) -> list[dict]:
    """Load one fixture file."""
    text = resources.files(__name__).joinpath(filename).read_text(encoding="utf-8")
    return json.loads(text)


def load_all() -> dict[str, list[dict]]:
    """Every fixture file, keyed by filename."""
    return {name: load(name) for name in (TRACES, TELEMETRY, DEVICES)}


def by_name(fixtures: list[dict], name: str) -> dict:
    """Look one fixture up, raising rather than returning a silent default."""
    for fixture in fixtures:
        if fixture["name"] == name:
            return fixture
    raise KeyError(f"No fixture named {name!r}")


def normalizable(fixtures: list[dict]) -> list[dict]:
    """Fixtures the matching normalizer is expected to accept."""
    return [f for f in fixtures if not f.get("expect", {}).get("normalized_is_null")]


def rows(fixtures: list[dict]) -> list[dict]:
    """Fixtures as flat gold-row dicts, with the sample as a JSON string.

    The sample is left as text so a caller can build the VARIANT column with
    ``parse_json`` exactly the way the pipeline does.
    """
    built: list[dict] = []
    for fixture in fixtures:
        row = dict(fixture["row"])
        row["sample_json"] = json.dumps(fixture["sample"], separators=(",", ":"))
        row["fixture_name"] = fixture["name"]
        built.append(row)
    return built


def expected_inventory_tuples(devices: list[dict]) -> set[tuple[Any, Any, Any]]:
    """Distinct (sensor_id, firmware, cal_version) change tuples in the fixtures."""
    return {
        (f["expect"]["sensor_id"], f["expect"]["firmware"], f["expect"]["cal_version"])
        for f in normalizable(devices)
    }


def expected_latest_sensors(devices: list[dict]) -> set[Any]:
    """Distinct sensor ids, i.e. how many rows the latest-inventory view holds."""
    return {f["expect"]["sensor_id"] for f in normalizable(devices)}
