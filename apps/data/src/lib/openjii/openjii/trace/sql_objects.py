"""Unity Catalog SQL objects for the v3 payload, shipped inside the wheel.

The DDL lives in ``openjii/trace/sql/*.sql`` and is registered by the
``centrum_v3_sql_objects`` task rather than by the DLT pipeline: these are shared
UC functions and views that dashboards, Genie and the DP pipelines call, and
declaring them in the pipeline would neither publish them under those names nor
survive outside a pipeline update.

Every statement is ``CREATE OR REPLACE``, so registration is idempotent and can
run on every deploy. File order is dependency order.
"""

from __future__ import annotations

from importlib import resources

_SQL_PACKAGE = "openjii.trace.sql"

# Dependency order: functions before the views that call them, and
# experiment_attached_sensors_latest after the view it filters.
STATEMENT_FILES: tuple[str, ...] = (
    "000_round_half_up.sql",
    "001_round_half_up_array.sql",
    "00_cal_version_hex8.sql",
    "01_measurement_object.sql",
    "02_trace_points.sql",
    "03_ambit_trace_v3.sql",
    "04_ambyte_telemetry_v1.sql",
    "05_ambit_device_v1.sql",
    "10_experiment_ambit_trace.sql",
    "11_experiment_ambyte_telemetry.sql",
    "12_experiment_environment_observations.sql",
    "13_experiment_device_health.sql",
    "14_experiment_attached_sensors.sql",
    "15_experiment_attached_sensors_latest.sql",
)

FUNCTIONS: tuple[str, ...] = (
    "round_half_up",
    "round_half_up_array",
    "cal_version_hex8",
    "measurement_object",
    "trace_points",
    "ambit_trace_v3",
    "ambyte_telemetry_v1",
    "ambit_device_v1",
)

VIEWS: tuple[str, ...] = (
    "experiment_ambit_trace",
    "experiment_ambyte_telemetry",
    "experiment_environment_observations",
    "experiment_device_health",
    "experiment_attached_sensors",
    "experiment_attached_sensors_latest",
)


# Gold writes the measurement object, not the firmware's one-element array. The
# same rule as the measurement_object() UC function, inline so the pipeline does
# not depend on a registered function: DLT would fail the whole update if the
# function were missing, and this is the one place that cannot tolerate that.
MEASUREMENT_OBJECT_EXPR = """
CASE
  WHEN try_variant_get(parse_json(sample), '$[0]') IS NOT NULL
   AND try_variant_get(parse_json(sample), '$[1]') IS NULL
    THEN try_variant_get(parse_json(sample), '$[0]')
  ELSE parse_json(sample)
END
""".strip()


def read_sql(filename: str) -> str:
    """Return one DDL file verbatim, placeholders unresolved."""
    return resources.files(_SQL_PACKAGE).joinpath(filename).read_text(encoding="utf-8")


def render(sql: str, catalog: str, schema: str = "centrum") -> str:
    """Substitute ``${catalog}`` / ``${schema}``.

    Identifiers are validated rather than quoted: these strings are executed as
    DDL, and a catalog name is deployment configuration, not user input.
    """
    return sql.replace("${catalog}", _identifier(catalog)).replace("${schema}", _identifier(schema))


def statements(catalog: str, schema: str = "centrum") -> list[str]:
    """Every DDL statement, rendered, in dependency order."""
    return [render(read_sql(name), catalog, schema).strip() for name in STATEMENT_FILES]


def _identifier(value: str) -> str:
    if not value or not all(c.isalnum() or c in "_-" for c in value):
        raise ValueError(f"Refusing to build DDL with the identifier {value!r}")
    return value
