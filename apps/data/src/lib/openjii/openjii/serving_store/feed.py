"""The sinks that send a pipeline's gold changes to the serving store."""

from __future__ import annotations

import itertools
import time
from types import ModuleType
from typing import Any

from pyspark.sql import DataFrame, SparkSession

from .tables import PAYLOAD_SCHEMAS, StoreTable
from .writer import StoreUnavailable, StoreWriter

# Bounds a catch-up batch, so the feed cannot hold the cores ingestion needs for long. Delta reads a
# commit whole, so one larger than this is still one batch, which the writer streams chunk by chunk.
MAX_BYTES_PER_TRIGGER = "128m"

# Waits on the driver while the store cannot take a batch. Waiting there holds only the sink's own
# flow, never the executors ingestion needs, and the sink never raises for the store's sake: three
# failures in a row would stop the whole pipeline.
DRIVER_RETRY_DELAYS = (10, 30, 60)


class StoreFeed:
    """One pipeline's store sinks, each reading its gold table's change feed in the same pipeline.

    A sink with a new checkpoint starts at the version in ``SERVING_STORE_FEED_START_<TABLE>``,
    which must still be within the gold table's file retention (seven days unless the table sets
    its own).
    """

    def __init__(self, dp: ModuleType, spark: SparkSession, dbutils: Any, environment: str):
        self.dp = dp
        self.spark = spark
        self.dbutils = dbutils
        self.scope = f"serving-store-{environment}"

    def define(self, table: StoreTable) -> None:
        start_version = self.spark.conf.get(f"SERVING_STORE_FEED_START_{table.name.upper()}")
        sink = f"serving_store_{table.name}"
        spark = self.spark

        @self.dp.foreach_batch_sink(name=sink)
        def write_batch(changes: DataFrame, batch_id: int) -> None:
            self.write(table, changes, batch_id)

        @self.dp.append_flow(target=sink, name=f"{sink}_changes")
        def read_changes() -> DataFrame:
            return (
                spark.readStream.option("readChangeFeed", "true")
                .option("startingVersion", start_version)
                .option("maxBytesPerTrigger", MAX_BYTES_PER_TRIGGER)
                .table(f"LIVE.{table.gold_table}")
            )

    def write(self, table: StoreTable, changes: DataFrame, batch_id: int) -> None:
        """Writes one batch, again and again until every row has gone; the dedup tokens drop what
        already landed. The credentials are read on every attempt, so a changed password takes
        effect without a restart. The batch's schemas go after its rows, gathered once, so a retry
        sends the same ones."""
        lines = table.lines(changes)
        schemas, unsent = self._schemas(table, changes, batch_id)
        for attempt in itertools.count():
            failure = self._write_once(table, lines, schemas, unsent, batch_id)
            if failure is None:
                return

            delay = DRIVER_RETRY_DELAYS[min(attempt, len(DRIVER_RETRY_DELAYS) - 1)]
            print(
                f"[serving store] {table.name} batch {batch_id}: {failure}, writing the batch again in {delay} s",
                flush=True,
            )
            time.sleep(delay)

    def _schemas(self, table: StoreTable, changes: DataFrame, batch_id: int) -> tuple[list[str], str | None]:
        """The batch's payload schemas, or none and why when Spark cannot work them out. The rows
        still go, and the reason goes to ``feed_rejects``, since an upload's rows arrive in one batch
        and no later one would bring its schemas."""
        try:
            return [row.line for row in table.schema_lines(changes).collect()], None
        except Exception as error:
            reason = f"batch {batch_id} went without its payload schemas: {type(error).__name__}: {error}"
            print(f"[serving store] {table.name} {reason}", flush=True)
            return [], reason

    def _write_once(
        self, table: StoreTable, lines: DataFrame, schemas: list[str], unsent: str | None, batch_id: int
    ) -> str | None:
        """Writes the batch once, returning why some of it did not go, or None when all of it did."""
        try:
            writer = self.writer()
        except Exception as error:
            # A missing scope or key is configuration, fixed by a deploy, like a wrong password.
            return f"no credentials from {self.scope}: {error}"

        try:
            writer.check()
        except StoreUnavailable as error:
            return str(error)

        written = writer.write(lines, table.name)
        if written.unfinished:
            return f"{written.unfinished} rows not sent"
        schemas_written = writer.insert(PAYLOAD_SCHEMAS, schemas)
        if schemas_written.unfinished:
            return f"{schemas_written.unfinished} schemas not sent"
        if unsent is not None:
            try:
                writer.reject_unsent_schemas(table.name, unsent)
            except StoreUnavailable as error:
                return str(error)

        print(
            f"[serving store] {table.name} batch {batch_id}: {written.inserted} inserted, "
            f"{written.rejected} rejected, {schemas_written.inserted} schemas, {schemas_written.rejected} refused",
            flush=True,
        )
        return None

    def writer(self) -> StoreWriter:
        return StoreWriter(
            self.dbutils.secrets.get(scope=self.scope, key="url"),
            self.dbutils.secrets.get(scope=self.scope, key="writer-username"),
            self.dbutils.secrets.get(scope=self.scope, key="writer-password"),
        )
