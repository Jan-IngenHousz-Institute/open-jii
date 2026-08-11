# Databricks notebook source
# DBTITLE 1,Smoke test - centrum v3 payload SQL objects
# Runs the shipped payload fixtures through the real DDL and checks the contract
# answers (ambyte-iot docs/mqtt-payload.md). This is the half of the test-suite
# that needs a warehouse: VARIANT, variant_explode and SQL UDFs do not exist in
# local PySpark, so the local tests pin the Python reference in openjii.trace and
# this task pins the SQL against the same fixtures and the same expectations.
#
# It never touches real data, and that is not a matter of passing the right
# parameter. The scratch schema is generated behind a hard-coded prefix by
# openjii.trace.scratch, validated before it is created and again before it is
# dropped, and cleanup runs in `finally`. No widget can point the DROP at a schema
# holding data; there is no schema parameter at all.
#
# Failures are collected and raised at the end, so one mismatch does not hide the
# rest and the job still fails.

# COMMAND ----------
import json
import logging

from pyspark.sql import SparkSession
from pyspark.sql import functions as F

from openjii.trace import fixtures, scratch, sql_objects, to_records
from openjii.trace.contract import round_to

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# COMMAND ----------

# DBTITLE 1,Configuration
dbutils.widgets.text("CATALOG_NAME", "", "Catalog (e.g. open_jii_dev)")
dbutils.widgets.dropdown("KEEP_SCHEMA", "false", ["false", "true"], "Keep the scratch schema")

CATALOG_NAME = scratch.assert_catalog(dbutils.widgets.get("CATALOG_NAME"))
KEEP_SCHEMA = dbutils.widgets.get("KEEP_SCHEMA") == "true"

spark = SparkSession.builder.getOrCreate()

# Name the schema after the run when the context offers an id, purely so a
# stranded schema is traceable; randomness is appended either way.
try:
    run_token = (
        dbutils.notebook.entry_point.getDbutils().notebook().getContext().jobRunId().get()
    )
except Exception:  # noqa: BLE001 - the id is cosmetic, never load-bearing
    run_token = None

SMOKE_SCHEMA = scratch.new_scratch_schema(run_token)
QUALIFIED = f"{CATALOG_NAME}.{SMOKE_SCHEMA}"
logger.info("Scratch schema for this run: %s", QUALIFIED)

failures: list[str] = []


def check(name: str, actual, expected) -> None:
    if actual != expected:
        failures.append(f"{name}: expected {expected!r}, got {actual!r}")
    else:
        logger.info("ok  %s", name)


def sort_key(record: tuple):
    """Order (series, t_ms, value) tuples where t_ms may be NULL.

    Malformed fixtures deliberately produce null timestamps, and Python cannot
    compare None with an int.
    """
    series, t_ms, value = record
    return (series, t_ms is None, t_ms or 0, value)


def literal(payload) -> str:
    return json.dumps(payload, separators=(",", ":")).replace("\\", "\\\\").replace("'", "\\'")


# COMMAND ----------

# DBTITLE 1,Seed the fixture table
all_fixtures = fixtures.load_all()
traces = all_fixtures[fixtures.TRACES]
telemetry = all_fixtures[fixtures.TELEMETRY]
devices = all_fixtures[fixtures.DEVICES]

seed_rows = [row for group in (traces, telemetry, devices) for row in fixtures.rows(group)]

try:
    spark.sql(f"CREATE SCHEMA {QUALIFIED}")

    seed_df = spark.createDataFrame(
        [
            (
                int(row["id"]),
                row["fixture_name"],
                row["experiment_id"],
                row["device_id"],
                row["client_id"],
                row["timestamp"],
                row["timezone"],
                row.get("protocol_id"),
                row.get("sensor_family"),
                row["sample_json"],
            )
            for row in seed_rows
        ],
        schema=(
            "id BIGINT, fixture_name STRING, experiment_id STRING, device_id STRING, "
            "client_id STRING, timestamp_text STRING, timezone STRING, protocol_id STRING, "
            "sensor_family STRING, sample STRING"
        ),
    )

    # Mirrors the gold table's shape for the columns the views read, including the
    # array unwrap gold applies to new writes.
    (
        seed_df.withColumn("timestamp", F.to_timestamp("timestamp_text"))
        .withColumn("date", F.to_date("timestamp"))
        .withColumn("user_id", F.lit(None).cast("string"))
        .withColumn("workbook_run_id", F.lit(None).cast("string"))
        .withColumn("latitude", F.lit(None).cast("double"))
        .withColumn("longitude", F.lit(None).cast("double"))
        .withColumn("data", F.expr(sql_objects.MEASUREMENT_OBJECT_EXPR))
        .drop("timestamp_text")
        .write.mode("overwrite")
        .saveAsTable(f"{QUALIFIED}.experiment_raw_data")
    )
    logger.info("Seeded %d fixture rows into %s.experiment_raw_data", len(seed_rows), QUALIFIED)

    # COMMAND ----------

    # DBTITLE 1,Register the objects against the fixture table
    for filename, statement in zip(
        sql_objects.STATEMENT_FILES, sql_objects.statements(CATALOG_NAME, SMOKE_SCHEMA)
    ):
        logger.info("Applying %s", filename)
        spark.sql(statement)

    # COMMAND ----------

    # DBTITLE 1,trace_points against the fixture expectations
    # Acceptance: correct timestamps for v3 fixtures (regular, explicit-t and
    # subsampled), for v2 rows through the compat view, at the freq-40 rounding
    # boundary, and NULL where a malformed series states no time.
    for fixture in fixtures.normalizable(traces):
        name = fixture["name"]
        payload = literal(fixture["sample"])
        points = spark.sql(
            f"""
            SELECT p.series, p.unit, p.value, unix_millis(p.t) AS t_ms
            FROM {QUALIFIED}.trace_points(
              {QUALIFIED}.ambit_trace_v3(parse_json('{payload}'), CAST(NULL AS TIMESTAMP))
            ) p
            """
        ).collect()

        check(f"{name}: point count", len(points), fixture["expect"]["point_count"])

        indexed: dict[tuple[str, int], dict] = {}
        counters: dict[str, int] = {}
        for point in points:
            position = counters.get(point["series"], 0)
            counters[point["series"]] = position + 1
            indexed[(point["series"], position)] = point

        for expected in fixture["expect"].get("points", []):
            key = (expected["series"], expected["index"])
            point = indexed.get(key)
            if point is None:
                failures.append(f"{name}: no point at {key}")
                continue
            check(f"{name} {key} t_ms", point["t_ms"], expected["t_ms"])
            check(f"{name} {key} value", round(float(point["value"]), 4), expected["value"])
            check(f"{name} {key} unit", point["unit"], expected["unit"])

        # Both v2 fluorescence spellings must resolve to one canonical series in
        # SQL too, with the same deterministic precedence the Python reference uses.
        expected_normalized = fixture["expect"].get("normalized") or {}
        if "legacy_fluo_alias" in expected_normalized:
            flags = spark.sql(
                f"""
                SELECT
                  try_variant_get(t, '$._compat.legacy_fluo_alias', 'boolean') AS legacy_alias,
                  array_size(try_variant_get(t, '$.series.fluo_630_signal.v', 'array<double>'))
                    AS signal_len,
                  try_element_at(
                    try_variant_get(t, '$.series.fluo_630_signal.v', 'array<double>'), 1
                  ) AS first_signal
                FROM (
                  SELECT {QUALIFIED}.ambit_trace_v3(
                    parse_json('{payload}'), CAST(NULL AS TIMESTAMP)
                  ) AS t
                )
                """
            ).collect()[0]
            check(
                f"{name}: legacy fluo alias flag",
                flags["legacy_alias"],
                True if expected_normalized["legacy_fluo_alias"] else None,
            )
            check(
                f"{name}: one canonical signal series",
                flags["signal_len"],
                len(expected_normalized["fluo_signal_v"]),
            )
            check(
                f"{name}: canonical spelling wins",
                flags["first_signal"],
                float(expected_normalized["fluo_signal_v"][0]),
            )

        # A measured zero window collapses every estimated env offset onto the run
        # start, so all leaf_temp points must share one epoch millisecond -- asserted
        # against the real SQL, not only the Python reference.
        if fixture["expect"].get("leaf_temp_collapses_to_one_millisecond"):
            leaf_ms = {p["t_ms"] for p in points if p["series"] == "leaf_temp"}
            check(f"{name}: zero duration collapses leaf_temp to one instant", len(leaf_ms), 1)
            check(f"{name}: that instant is the run start", leaf_ms, {1785965160359})

        # The SQL and the notebook helper must agree point for point, including
        # the null timestamps: one contract, two implementations.
        reference = to_records(fixture["sample"])
        check(
            f"{name}: SQL matches openjii.trace.to_records",
            sorted(
                ((p["series"], p["t_ms"], round(float(p["value"]), 4)) for p in points),
                key=sort_key,
            ),
            sorted(
                (
                    (
                        r["series"],
                        round(r["t"].timestamp() * 1000) if r["t"] else None,
                        round(float(r["value"]), 4),
                    )
                    for r in reference
                ),
                key=sort_key,
            ),
        )

    # COMMAND ----------

    # DBTITLE 1,History's wrapped sample array reads the same as an unwrapped row
    # Gold unwraps new writes only, so both shapes are in the table forever. The
    # normalizer and the macro must not care which one they are handed.
    for name in ("v3_regular", "v2_regular_t_est"):
        fixture = fixtures.by_name(traces, name)
        wrapped = literal(fixture["sample"])
        unwrapped = literal(fixture["sample"][0])
        row = spark.sql(
            f"""
            SELECT
              CAST({QUALIFIED}.ambit_trace_v3(parse_json('{wrapped}'), CAST(NULL AS TIMESTAMP))
                AS STRING) AS from_array,
              CAST({QUALIFIED}.ambit_trace_v3(parse_json('{unwrapped}'), CAST(NULL AS TIMESTAMP))
                AS STRING) AS from_object,
              (SELECT count(*) FROM {QUALIFIED}.trace_points(parse_json('{wrapped}')))
                AS wrapped_points,
              (SELECT count(*) FROM {QUALIFIED}.trace_points(parse_json('{unwrapped}')))
                AS object_points
            """
        ).collect()[0]
        check(
            f"{name}: array and object normalize identically",
            row["from_array"],
            row["from_object"],
        )
        check(
            f"{name}: trace_points reads the wrapped shape",
            row["wrapped_points"],
            row["object_points"],
        )

    # COMMAND ----------

    # DBTITLE 1,The shared rounding primitive is half away from zero on both signs
    # openjii.trace.round_to and round_half_up() must be one rule. A positive-only
    # floor(x*scale+0.5) passes every positive fixture and still rounds -24.605 to
    # -24.60, so the primitive is probed directly at the signed boundaries.
    signed_cases = [(-24.605, 2), (-0.005, 2), (-0.14945, 4), (24.605, 2), (0.005, 2), (0.14945, 4), (0.0, 2)]
    probe = spark.sql(
        "SELECT "
        + ", ".join(
            f"{QUALIFIED}.round_half_up(CAST({value} AS DOUBLE), {decimals}) AS c{index}"
            for index, (value, decimals) in enumerate(signed_cases)
        )
    ).collect()[0]
    for index, (value, decimals) in enumerate(signed_cases):
        check(
            f"round_half_up({value}, {decimals})",
            probe[f"c{index}"],
            round_to(value, decimals),
        )

    array_probe = spark.sql(
        f"SELECT {QUALIFIED}.round_half_up_array("
        "array(CAST(-24.605 AS DOUBLE), CAST(-0.005 AS DOUBLE), CAST(24.605 AS DOUBLE), "
        "CAST(0.0 AS DOUBLE), NULL), 2) AS rounded"
    ).collect()[0]["rounded"]
    check(
        "round_half_up_array keeps the sign rule and the NULL holes",
        array_probe,
        [round_to(-24.605, 2), round_to(-0.005, 2), round_to(24.605, 2), 0.0, None],
    )

    # COMMAND ----------

    # DBTITLE 1,Mixed v2/v3 replay drops no rows
    trace_view = spark.table(f"{QUALIFIED}.experiment_ambit_trace")
    check("trace view row count", trace_view.count(), len(fixtures.normalizable(traces)))
    check(
        "every trace view row is normalized to ambit.trace/3",
        sorted({row["schema_tag"] for row in trace_view.select("schema_tag").collect()}),
        ["ambit.trace/3"],
    )
    check(
        "trace view excludes non-trace rows",
        trace_view.filter(
            F.col("source_row_id")
            == fixtures.by_name(traces, "not_a_trace_multispeq")["row"]["id"]
        ).count(),
        0,
    )
    check(
        "v2 rows keep their topic-derived attribution",
        trace_view.filter(
            F.col("source_row_id") == fixtures.by_name(traces, "v2_regular_t_est")["row"]["id"]
        ).collect()[0]["protocol_id"],
        "b1946ac9-2b1e-4f2c-9f4a-1a2b3c4d5e6f",
    )
    check(
        "estimated leaf_temp times are flagged",
        sorted(
            (row["source_row_id"], row["leaf_temp_time_estimated"])
            for row in trace_view.select("source_row_id", "leaf_temp_time_estimated").collect()
        ),
        sorted(
            (f["row"]["id"], f["expect"]["leaf_temp_time_estimated"])
            for f in fixtures.normalizable(traces)
        ),
    )

    # COMMAND ----------

    # DBTITLE 1,Forced v2 fallback: SQL identity precedence, one row in one row out
    # A v3-capable Ambyte deliberately emits an unchanged v2 row when identity or
    # calibration is unavailable, so a fallback row and a native legacy row arrive
    # side by side. Both must normalize to exactly one canonical object, and the
    # SQL -- not only the Python reference -- must apply the §8 identity
    # precedence, including reading metadata.sensor_id on the fallback row.
    for name in ("v2_forced_fallback_new_firmware", "v2_native_legacy_no_identity"):
        fixture = fixtures.by_name(traces, name)
        expected = fixture["expect"]["normalized"]
        row = spark.sql(
            f"""
            SELECT
              try_variant_get(t, '$.sensor_id', 'string') AS sensor_id,
              try_variant_get(t, '$.device', 'string') AS device,
              try_variant_get(t, '$.schema', 'string') AS schema_tag,
              try_variant_get(t, '$._compat.source', 'string') AS source
            FROM (
              SELECT {QUALIFIED}.ambit_trace_v3(
                parse_json('{literal(fixture["sample"])}'), CAST(NULL AS TIMESTAMP)
              ) AS t
            )
            """
        ).collect()
        check(f"{name}: one canonical object per input row", len(row), 1)
        check(f"{name}: SQL sensor_id precedence", row[0]["sensor_id"], expected.get("sensor_id"))
        check(f"{name}: normalized schema", row[0]["schema_tag"], "ambit.trace/3")
        check(f"{name}: recorded as a v2 source", row[0]["source"], "v2")
        # The non-unique human name never stands in for a missing identity.
        if expected.get("sensor_id") is None:
            check(f"{name}: no identity invented", row[0]["sensor_id"], None)

    fallback_rows = trace_view.filter(
        F.col("source_row_id").isin(
            [
                fixtures.by_name(traces, "v2_forced_fallback_new_firmware")["row"]["id"],
                fixtures.by_name(traces, "v2_native_legacy_no_identity")["row"]["id"],
            ]
        )
    )
    check("both fallback generations survive the replay", fallback_rows.count(), 2)

    # COMMAND ----------

    # DBTITLE 1,Telemetry: one environment projection and one health projection per event
    environment = spark.table(f"{QUALIFIED}.experiment_environment_observations")
    health = spark.table(f"{QUALIFIED}.experiment_device_health")
    expected_telemetry = fixtures.normalizable(telemetry)

    check(
        "telemetry rows",
        spark.table(f"{QUALIFIED}.experiment_ambyte_telemetry").count(),
        len(expected_telemetry),
    )
    check("environment projection rows", environment.count(), len(expected_telemetry))
    check("health projection rows", health.count(), len(expected_telemetry))

    # Same source event identity on both sides: same row, same measure_id, same time.
    identity_columns = ["source_row_id", "measure_id", "observed_utc_ms"]
    check(
        "environment and health share one source identity",
        sorted(tuple(r) for r in environment.select(*identity_columns).collect()),
        sorted(tuple(r) for r in health.select(*identity_columns).collect()),
    )

    HEALTH_LEAVES = [
        "wifi",
        "provisioned",
        "publish_gate",
        "mqtt_reconnects",
        "last_disc_reason",
        "conn_age_s",
        "pending",
        "battery_v",
        "input_v",
        "system_v",
        "input_ma",
        "charge_ma",
        "input_present",
        "charge_status",
        "db_online",
        "sd_free_kb",
        "sd_skipped",
        "sd_dropped",
        "last_acked_id",
        "sd_io_lost",
        "uptime_s",
        "psram_free_kb",
        "psram_largest_kb",
        "psram_size_kb",
        "heap_dma_largest_kb",
        "heap_int_free_kb",
        "heap_int_largest_kb",
        "wd_armed",
        "last_wd_reboot_reason",
        "clock_source",
        "clock_suspect",
        "firmware",
        "script_sha256",
        "script_version",
        "script_built_against_fw",
        "script_installed_on_fw",
        "script_metadata_verified",
    ]

    for fixture in expected_telemetry:
        expect = fixture["expect"]
        row = environment.filter(F.col("source_row_id") == fixture["row"]["id"]).collect()[0]
        health_row = health.filter(F.col("source_row_id") == fixture["row"]["id"]).collect()[0]
        name = fixture["name"]
        check(f"{name}: measure_id", row["measure_id"], expect["measure_id"])
        check(f"{name}: device", row["device_id"], expect["device"])
        check(f"{name}: observed_utc_ms", row["observed_utc_ms"], expect["observed_utc_ms"])
        check(f"{name}: source_generation", row["source_generation"], expect["source_generation"])
        check(f"{name}: air_temperature", row["air_temperature"], expect["air_temperature"])
        check(f"{name}: relative_humidity", row["relative_humidity"], expect["relative_humidity"])
        check(f"{name}: air_pressure", row["air_pressure"], expect["air_pressure"])
        check(f"{name}: battery_v", health_row["battery_v"], expect.get("battery_v"))
        if "input_v" in expect:
            check(f"{name}: input_v", health_row["input_v"], expect["input_v"])
        check(
            f"{name}: attached sensor count",
            len(health_row["attached_sensors"] or []),
            expect["attached_sensor_count"],
        )
        if "clock_source" in expect:
            check(f"{name}: clock_source", health_row["clock_source"], expect["clock_source"])
        if "firmware" in expect:
            check(f"{name}: firmware", health_row["firmware"], expect["firmware"])
        # An explicit BME280 snapshot samples no health at all, whatever its
        # data/metadata happens to carry.
        if expect.get("health_is_empty"):
            leaked = [leaf for leaf in HEALTH_LEAVES if health_row[leaf] is not None]
            check(f"{name}: no health leaked into the BME snapshot", leaked, [])
            check(f"{name}: no attached sensors on a BME snapshot", health_row["attached_sensors"], [])
        for expected_sensor in expect.get("attached_sensors", []):
            actual = next(
                (
                    s
                    for s in health_row["attached_sensors"]
                    if s["channel"] == expected_sensor["channel"]
                ),
                None,
            )
            if actual is None:
                failures.append(f"{name}: no attached sensor on {expected_sensor['channel']}")
                continue
            for field, value in expected_sensor.items():
                check(f"{name} {expected_sensor['channel']} {field}", actual[field], value)

    # COMMAND ----------

    # DBTITLE 1,Inventory: an unchanged repeated tuple collapses to one record
    inventory = spark.table(f"{QUALIFIED}.experiment_attached_sensors")
    latest = spark.table(f"{QUALIFIED}.experiment_attached_sensors_latest")

    check(
        "inventory records equal the distinct change tuples",
        sorted(
            (r["sensor_id"], r["firmware"], r["cal_version"])
            for r in inventory.select("sensor_id", "firmware", "cal_version").collect()
        ),
        sorted(fixtures.expected_inventory_tuples(devices)),
    )
    check(
        "the repeated tuple collapsed to one record",
        inventory.filter(
            "sensor_id = '10:91:A8:4F:4F:D4' AND cal_version = '6a4356a8'"
        ).collect()[0]["observation_count"],
        2,
    )
    check(
        "latest inventory holds one record per sensor",
        sorted(r["sensor_id"] for r in latest.select("sensor_id").collect()),
        sorted(fixtures.expected_latest_sensors(devices)),
    )

    for fixture in fixtures.normalizable(devices):
        expect = fixture["expect"]
        if not expect.get("is_latest_for_sensor"):
            continue
        row = latest.filter(F.col("sensor_id") == expect["sensor_id"]).collect()[0]
        name = fixture["name"]
        check(f"{name}: latest cal_version", row["cal_version"], expect["cal_version"])
        check(f"{name}: latest firmware", row["firmware"], expect["firmware"])
        check(f"{name}: channel", row["channel"], expect["channel"])
        check(
            f"{name}: calibration_complete",
            row["calibration_complete"],
            expect["calibration_complete"],
        )
        check(f"{name}: source_generation", row["source_generation"], expect["source_generation"])
        check(
            f"{name}: hardware_revision",
            row["hardware_revision"],
            expect.get("hardware_revision"),
        )

finally:
    # Only ever the schema this run generated, re-validated at the point of use.
    if KEEP_SCHEMA:
        logger.warning("KEEP_SCHEMA=true, leaving %s in place", QUALIFIED)
    else:
        dropped = scratch.assert_disposable(SMOKE_SCHEMA)
        spark.sql(f"DROP SCHEMA IF EXISTS {CATALOG_NAME}.{dropped} CASCADE")
        logger.info("Dropped scratch schema %s.%s", CATALOG_NAME, dropped)

# COMMAND ----------

# DBTITLE 1,Result
if failures:
    for failure in failures:
        logger.error("FAIL %s", failure)
    raise AssertionError(f"{len(failures)} v3 SQL contract check(s) failed")

logger.info("All v3 SQL contract checks passed")
