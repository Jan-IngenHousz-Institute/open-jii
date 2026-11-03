"""Replaces what the serving store holds for one experiment, or for every one, with what gold holds
now: the first load, and the repair for what the feed cannot send, such as rows gold removed."""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime

from pyspark.sql import DataFrame, SparkSession, Window
from pyspark.sql import functions as F

from .tables import StoreTable
from .writer import StoreUnavailable, StoreWriter, Written

# Waits between writes of the whole load while the store cannot take some of it; the dedup tokens
# drop what already landed. A reload is run by hand, so after the last it fails instead of waiting.
WRITE_RETRY_DELAYS = (10, 30, 60, 120, 300)


class StoreAheadOfGold(Exception):
    """The store holds a commit newer than gold's latest, as after gold's table was recreated."""


@dataclass(frozen=True)
class Reloaded:
    table: str
    version: int
    written: Written
    # Rows per experiment, one per store key: gold's at the version, and the store's afterwards by
    # where the newest commit of each falls against the version.
    gold: dict[str, int]
    store: dict[str, int]
    newer: dict[str, int]
    older: dict[str, int]

    @property
    def short(self) -> dict[str, int]:
        """The experiments whose rows at the version or newer are fewer than gold's, and by how many.
        Exact for an experiment the feed wrote nothing newer to; otherwise the feed's new rows can
        make up for as many missing ones."""
        return {
            experiment: rows - self.store.get(experiment, 0)
            for experiment, rows in self.gold.items()
            if rows > self.store.get(experiment, 0)
        }

    @property
    def missing(self) -> int:
        """Rows gold holds that the store lacks."""
        return sum(self.short.values())


class StoreReload:
    """Loads a store table from gold as gold holds it at its latest version, then deletes the
    store's rows from older versions.

    Inserting first keeps an experiment readable throughout. The store keeps a row's newest commit,
    so the delete takes the copies the load replaced and the rows gold no longer holds, and leaves
    what the live feed writes meanwhile.
    """

    def __init__(self, spark: SparkSession, writer: StoreWriter, gold_schema: str):
        self.spark = spark
        self.writer = writer
        self.gold_schema = gold_schema

    def reload(self, table: StoreTable, experiment_id: str | None = None) -> Reloaded:
        """Reloads one experiment, or every experiment when ``experiment_id`` is None. An
        experiment gold no longer holds leaves the store with it. When the store refuses any row,
        nothing is deleted, since a refused row's older copy is the only one the store has."""
        # Read first, so a commit the feed sends meanwhile cannot look newer than gold's latest.
        newest = self._newest_stored_version(table)
        version, committed_at = self.latest_version(table)
        if newest > version:
            raise StoreAheadOfGold(
                f"store.{table.name} holds version {newest} and gold's {table.gold_table} only "
                f"{version}: empty the store table first (docs/runbooks/procedures/serving-store-reload.md)"
            )

        rows = self.gold_rows(table, version)
        if experiment_id is not None:
            rows = rows.filter(F.col("experiment_id") == experiment_id)
        rows = self._newest_copies(table, rows)
        changes = rows.withColumns(
            {
                "_change_type": F.lit("insert"),
                "_commit_version": F.lit(version).cast("long"),
                "_commit_timestamp": F.lit(committed_at),
            }
        )

        written = self._write(table, changes)
        if not written.rejected:
            self._delete_older(table, version, experiment_id)

        gold = rows.select(*table.key()).dropDuplicates().groupBy("experiment_id").count().collect()
        stored = self._stored_rows(table, version, experiment_id)
        return Reloaded(
            table.name,
            version,
            written,
            gold={row["experiment_id"]: row["count"] for row in gold},
            store={row["experiment_id"]: int(row["current"]) for row in stored if int(row["current"])},
            newer={row["experiment_id"]: int(row["newer"]) for row in stored if int(row["newer"])},
            older={row["experiment_id"]: int(row["older"]) for row in stored if int(row["older"])},
        )

    def latest_version(self, table: StoreTable) -> tuple[int, datetime]:
        """Gold's latest commit, as its version and time."""
        [commit] = self.spark.sql(f"DESCRIBE HISTORY {self._gold_name(table)} LIMIT 1").collect()
        return commit["version"], commit["timestamp"]

    def gold_rows(self, table: StoreTable, version: int) -> DataFrame:
        """Gold's rows at ``version``, each with the commit that added it."""
        return self.spark.sql(
            f"SELECT *, _metadata.row_commit_version AS _row_commit_version "
            f"FROM {self._gold_name(table)} VERSION AS OF {version}"
        )

    def _newest_copies(self, table: StoreTable, rows: DataFrame) -> DataFrame:
        """Gold's newest copy of each store key, the one the store keeps from the feed. Gold's tables
        only append, so a recomputed row stands beside the one it replaces, and a load sends every
        row at one version, which would leave the store to keep either."""
        newest = Window.partitionBy(*table.key()).orderBy(F.col("_row_commit_version").desc())
        return (
            rows.withColumn("_copy", F.row_number().over(newest))
            .filter(F.col("_copy") == 1)
            .drop("_copy", "_row_commit_version")
        )

    def _gold_name(self, table: StoreTable) -> str:
        return f"{self.gold_schema}.{table.gold_table}"

    def _write(self, table: StoreTable, changes: DataFrame) -> Written:
        """Writes the load, again until every row has gone."""
        lines = table.lines(changes, reloaded=True)
        delays = iter(WRITE_RETRY_DELAYS)
        while True:
            written = self.writer.write(lines, table.name)
            if not written.unfinished:
                return written

            delay = next(delays, None)
            if delay is None:
                raise StoreUnavailable(
                    f"{written.unfinished} rows of {table.name} not sent after {len(WRITE_RETRY_DELAYS) + 1} attempts"
                )
            print(
                f"[serving store] Reload of {table.name}: {written.unfinished} rows not sent, "
                f"writing the load again in {delay} s",
                flush=True,
            )
            time.sleep(delay)

    def _newest_stored_version(self, table: StoreTable) -> int:
        [row] = self.writer.query(
            f"SELECT max(_commit_version) AS newest FROM {self.writer.database}.{table.name} FORMAT JSONEachRow"
        )
        return int(row["newest"])

    def _delete_older(self, table: StoreTable, version: int, experiment_id: str | None) -> None:
        """Deletes the store's rows from before ``version``. The delete returns once every part is
        marked, so the count after it sees the result."""
        scope, parameters = self._scope(experiment_id)
        self.writer.query(
            f"DELETE FROM {self.writer.database}.{table.name} WHERE _commit_version < {{version:Int64}}{scope}",
            version=version,
            **parameters,
        )

    def _stored_rows(self, table: StoreTable, version: int, experiment_id: str | None) -> list[dict]:
        """The store's rows per experiment, one per key, counted by where each one's newest commit
        falls against ``version``. A row older than it came back after the delete, from a feed
        still catching up on commits before the version."""
        scope, parameters = self._scope(experiment_id)
        return self.writer.query(
            "SELECT experiment_id, countIf(_commit_version >= {version:Int64}) AS current, "
            "countIf(_commit_version > {version:Int64}) AS newer, "
            "countIf(_commit_version < {version:Int64}) AS older "
            f"FROM {self.writer.database}.{table.name} FINAL WHERE 1{scope} GROUP BY experiment_id "
            # A count is a read, under the cap every read has; the reloader's profile lifts it for inserts.
            "SETTINGS max_memory_usage = 4294967296 FORMAT JSONEachRow",
            version=version,
            **parameters,
        )

    def _scope(self, experiment_id: str | None) -> tuple[str, dict[str, str]]:
        """The condition that limits a statement to one experiment, and its parameter."""
        if experiment_id is None:
            return "", {}
        return " AND experiment_id = {experiment:String}", {"experiment": experiment_id}
