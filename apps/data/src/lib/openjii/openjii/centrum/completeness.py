"""Derived workbook-attempt completeness.

This intentionally recomputes from the latest manifest and all received rows;
no partial/complete state is written back, so late rows can heal an attempt.
"""

from __future__ import annotations

from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F


def derive_workbook_run_completeness(manifests: DataFrame, measurements: DataFrame) -> DataFrame:
    """Compare expected producer/device pairs with rows received per attempt."""
    latest_manifest = (
        manifests.where(F.col("workbook_attempt_id").isNotNull())
        .withColumn(
            "_manifest_rank",
            F.row_number().over(
                Window.partitionBy("workbook_attempt_id").orderBy(
                    F.col("ingestion_timestamp").desc_nulls_last(),
                    F.col("kinesis_sequence_number").desc_nulls_last(),
                )
            ),
        )
        .where(F.col("_manifest_rank") == 1)
        .drop("_manifest_rank")
    )

    expected_pairs = (
        latest_manifest.select(
            "workbook_attempt_id",
            F.explode_outer("expected").alias("expected_entry"),
        )
        .select(
            "workbook_attempt_id",
            F.col("expected_entry.producer_cell_id").alias("producer_cell_id"),
            F.explode_outer("expected_entry.device_ids").alias("device_id"),
        )
        .where(F.col("producer_cell_id").isNotNull() & F.col("device_id").isNotNull())
        .dropDuplicates(["workbook_attempt_id", "producer_cell_id", "device_id"])
    )

    received_pairs = (
        measurements.where(
            F.col("workbook_attempt_id").isNotNull()
            & F.col("producer_cell_id").isNotNull()
            & F.col("device_id").isNotNull()
        )
        .select("workbook_attempt_id", "producer_cell_id", "device_id")
        .dropDuplicates(["workbook_attempt_id", "producer_cell_id", "device_id"])
        .withColumn("_received", F.lit(True))
    )

    pair_summary = (
        expected_pairs.join(
            received_pairs,
            ["workbook_attempt_id", "producer_cell_id", "device_id"],
            "left",
        )
        .groupBy("workbook_attempt_id")
        .agg(
            F.count(F.lit(1)).alias("expected_count"),
            F.sum(F.when(F.col("_received") == F.lit(True), 1).otherwise(0)).alias("received_count"),
            F.collect_list(
                F.when(
                    F.col("_received").isNull(),
                    F.struct("producer_cell_id", "device_id"),
                )
            ).alias("missing_pairs"),
        )
    )

    manifest_attempts = (
        latest_manifest.select(
            "experiment_id",
            "workbook_attempt_id",
            "workbook_version_id",
            "terminal_status",
            F.col("ingestion_timestamp").alias("manifest_ingestion_timestamp"),
        )
        .join(pair_summary, "workbook_attempt_id", "left")
        .withColumn("expected_count", F.coalesce(F.col("expected_count"), F.lit(0)))
        .withColumn("received_count", F.coalesce(F.col("received_count"), F.lit(0)))
        .withColumn(
            "missing_pairs",
            F.coalesce(
                F.col("missing_pairs"),
                F.from_json(F.lit("[]"), "array<struct<producer_cell_id:string,device_id:string>>"),
            ),
        )
        .withColumn("_has_manifest", F.lit(True))
    )

    measurement_attempts = (
        measurements.where(F.col("workbook_attempt_id").isNotNull())
        .groupBy("workbook_attempt_id")
        .agg(
            F.first("experiment_id", ignorenulls=True).alias("measurement_experiment_id"),
            F.first("workbook_version_id", ignorenulls=True).alias("measurement_workbook_version_id"),
            F.max("processed_timestamp").alias("last_measurement_timestamp"),
        )
    )

    return (
        manifest_attempts.alias("manifest")
        .join(measurement_attempts.alias("measurement"), "workbook_attempt_id", "full")
        .select(
            F.coalesce(F.col("manifest.experiment_id"), F.col("measurement.measurement_experiment_id")).alias(
                "experiment_id"
            ),
            "workbook_attempt_id",
            F.coalesce(
                F.col("manifest.workbook_version_id"),
                F.col("measurement.measurement_workbook_version_id"),
            ).alias("workbook_version_id"),
            F.col("manifest.terminal_status").alias("terminal_status"),
            F.col("manifest.expected_count").alias("expected_count"),
            F.col("manifest.received_count").alias("received_count"),
            F.col("manifest.missing_pairs").alias("missing_pairs"),
            F.when(F.col("manifest._has_manifest").isNull(), F.lit("unknown"))
            .when(F.col("manifest.expected_count") == F.col("manifest.received_count"), F.lit("complete"))
            .otherwise(F.lit("partial"))
            .alias("completeness"),
            F.col("manifest.manifest_ingestion_timestamp").alias("manifest_ingestion_timestamp"),
            F.col("measurement.last_measurement_timestamp").alias("last_measurement_timestamp"),
        )
    )
