"""The test store ``pnpm test`` starts runs the ClickHouse release the serving store module installs."""

from __future__ import annotations

from pathlib import Path

import hcl2
import yaml

_ROOT = Path(__file__).parents[4]
_COMPOSE = _ROOT / "packages/database/docker-compose.yml"
_VARIABLES = _ROOT / "infrastructure/modules/serving-store/variables.tf"


def _module_release() -> str:
    variables = hcl2.loads(
        _VARIABLES.read_text(),
        serialization_options=hcl2.SerializationOptions(strip_string_quotes=True),
    )
    [release] = [
        block["clickhouse_version"]["default"]
        for block in variables["variable"]
        if "clickhouse_version" in block
    ]
    return release


def test_the_test_store_image_is_the_release_the_module_pins() -> None:
    compose = yaml.safe_load(_COMPOSE.read_text())

    assert compose["services"]["clickhouse"]["image"] == f"clickhouse/clickhouse-server:{_module_release()}"
