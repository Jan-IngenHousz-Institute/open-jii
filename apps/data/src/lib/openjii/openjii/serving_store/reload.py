"""Replaces what the serving store holds for one experiment, or for every one, with what its source
table holds now: the first load, and the repair for what the feed cannot send, such as rows the
source removed."""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

from .tables import PAYLOAD_SCHEMAS, StoreTable
from .writer import StoreUnavailable, StoreWriter, Written

# Waits between writes of the whole load while the store cannot take some of it; the dedup tokens
# drop what already landed. A reload is run by hand, so after the last it fails instead of waiting.
WRITE_RETRY_DELAYS = (10, 30, 60, 120, 300)

# Each id table, the column it lists, and the column that holds the id in each table whose rows it
# lists, as packages/database/clickhouse/migrations/0006_experiment_ids.sql fills them.
ID_SOURCES = {
    "contributor_ids": (
        "user_id",
        {"measurements": "user_id", "macro_results": "user_id", "uploads": "created_by"},
    ),
    "client_ids": ("client_id", {"measurements": "client_id", "macro_results": "client_id"}),
}

# More rows than this that the source no longer holds stop a reload before its delete, unless
# asked for. A repair removes a few; a table part way through a refresh looks as if it lost most.
REMOVAL_LIMIT = 1000

# The store table where each reload of every experiment that passed its checks records itself.
COMPLETED_RELOADS = "completed_reloads"

# How long before a reload a settle can still have started and not yet landed, in nanoseconds of the
# store's stamps. The store ends a settle after 30 s; an hour leaves room for a stalled disk write.
SETTLE_IN_FLIGHT_NS = 3600 * 10**9


class StoreAheadOfSource(Exception):
    """The store holds a commit newer than its source table's latest, as after that table was
    recreated."""


class RemovalOverLimit(Exception):
    """The delete would take more rows that the source no longer holds than a reload removes
    unasked."""


@dataclass(frozen=True)
class Reloaded:
    table: str
    version: int
    written: Written
    schemas: Written
    # Rows per experiment, or per device, one per store key: the source's at the version, and the
    # store's afterwards by where the newest commit of each falls against the version.
    source: dict[str, int]
    store: dict[str, int]
    newer: dict[str, int]
    older: dict[str, int]
    # The experiments whose copies by device do not hold the captures the table holds with a client,
    # at the version or older, each with how many more rows the copies hold: fewer when negative, and
    # 0 when only which ones differ.
    unmatched_copies: dict[str, int] = field(default_factory=dict)

    @property
    def short(self) -> dict[str, int]:
        """The experiments, or devices, whose rows at the version or newer are fewer than the
        source's, and by how many. Exact for one the feed wrote nothing newer to; otherwise the
        feed's new rows can make up for as many missing ones."""
        return {
            scope: rows - self.store.get(scope, 0)
            for scope, rows in self.source.items()
            if rows > self.store.get(scope, 0)
        }

    @property
    def missing(self) -> int:
        """Rows the source holds that the store lacks."""
        return sum(self.short.values())

    @property
    def passed(self) -> bool:
        """Whether the store took every row and schema, lacks none of the source's rows, holds none
        from before the version, and its copies of the table hold what it holds."""
        return not (
            self.written.rejected
            or self.schemas.rejected
            or self.missing
            or self.older
            or self.unmatched_copies
        )


class StoreReload:
    """Loads a store table from its source table as that holds it at its latest version, then
    deletes the store's rows from older versions.

    Inserting first keeps an experiment readable throughout. The store keeps a row's newest commit,
    so the delete takes the copies the load replaced and the rows the source no longer holds, and
    leaves what the live feed writes meanwhile.
    """

    def __init__(self, spark: SparkSession, writer: StoreWriter, source_schema: str):
        self.spark = spark
        self.writer = writer
        self.source_schema = source_schema

    def reload(
        self, table: StoreTable, experiment_id: str | None = None, allow_removal: bool = False
    ) -> Reloaded:
        """Reloads one experiment, or every experiment when ``experiment_id`` is None. An
        experiment the source no longer holds leaves the store with it, once ``allow_removal`` says
        more than ``REMOVAL_LIMIT`` rows may go. When the store refuses any row, nothing is deleted,
        since a refused row's older copy is the only one the store has, and a refused schema keeps
        the older schemas for the same reason.

        A reload of every experiment that passed records itself in ``COMPLETED_RELOADS``, even one
        that found no rows, and one that fails before it ends records nothing."""
        # Read first, so a commit the feed sends meanwhile cannot look newer than the source's
        # latest.
        newest = self._newest_stored_version(table)
        version, committed_at = self.latest_version(table)
        if newest > version:
            held_in = [table.name, *table.derived_tables]
            if table.payloads:
                held_in.append(PAYLOAD_SCHEMAS)
            raise StoreAheadOfSource(
                f"the store holds version {newest} and {self._source_name(table)} only {version}: empty "
                + ", ".join(f"store.{store_table}" for store_table in held_in)
                + " first (docs/runbooks/procedures/serving-store-reload.md)"
            )

        rows = self.source_rows(table, version)
        if experiment_id is not None:
            rows = rows.filter(F.col("experiment_id") == experiment_id)
        rows = table.reloaded_rows(table.newest_copies(rows), self.beside_source)
        changes = rows.withColumns(
            {
                "_change_type": F.lit("insert"),
                "_commit_version": F.lit(version).cast("long"),
                "_commit_timestamp": F.lit(committed_at),
            }
        )

        written = self._write(table, changes)
        schemas = self._write_schemas(table, changes)
        fills_id_tables = any(table.name in sources for _, sources in ID_SOURCES.values())
        if not written.rejected:
            if not allow_removal:
                self._check_removal(table, version, experiment_id)
            self._delete_older(table.name, version, experiment_id)
            for copy in table.derived_tables:
                self._retire_older(copy, version, experiment_id)
            if table.payloads and not schemas.rejected:
                # A table type's schemas carry its source table's versions, so the older ones are
                # those only rows from before the load had.
                self._delete_older(PAYLOAD_SCHEMAS, version, experiment_id, table_type=table.table_type)
            if fills_id_tables:
                self._prune_ids(experiment_id)

        counted_by = table.counted_by
        in_source = rows.select(*table.key()).dropDuplicates().groupBy(counted_by).count().collect()
        stored = self._stored_rows(table, version, experiment_id)
        reloaded = Reloaded(
            table.name,
            version,
            written,
            schemas,
            source={row[counted_by]: row["count"] for row in in_source},
            store={row[counted_by]: int(row["current"]) for row in stored if int(row["current"])},
            newer={row[counted_by]: int(row["newer"]) for row in stored if int(row["newer"])},
            older={row[counted_by]: int(row["older"]) for row in stored if int(row["older"])},
            unmatched_copies=self._unmatched_copies(table, version, experiment_id),
        )
        if experiment_id is None and reloaded.passed:
            self.writer.query(
                f"INSERT INTO {self.writer.database}.{COMPLETED_RELOADS} (table_name, version) "
                "SELECT {table:String}, {version:Int64}",
                table=table.name,
                version=version,
            )
        return reloaded

    def latest_version(self, table: StoreTable) -> tuple[int, datetime]:
        """The source table's latest commit, as its version and time."""
        [commit] = self.spark.sql(f"DESCRIBE HISTORY {self._source_name(table)} LIMIT 1").collect()
        return commit["version"], commit["timestamp"]

    def source_rows(self, table: StoreTable, version: int) -> DataFrame:
        """The source table's rows at ``version``."""
        return self.spark.sql(f"SELECT * FROM {self._source_name(table)} VERSION AS OF {version}")

    def beside_source(self, name: str) -> DataFrame:
        """Another table of the source's schema, as it is now."""
        return self.spark.table(f"{self.source_schema}.{name}")

    def _source_name(self, table: StoreTable) -> str:
        return f"{self.source_schema}.{table.source_table}"

    def _write(self, table: StoreTable, changes: DataFrame) -> Written:
        """Writes the load, again until every row has gone."""
        lines = table.lines(changes, reloaded=True)
        return self._until_sent(f"rows of {table.name}", lambda: self.writer.write(lines, table.name))

    def _write_schemas(self, table: StoreTable, changes: DataFrame) -> Written:
        """Sends the load's payload schemas, rebuilt from the source's rows as the rows are."""
        if not table.payloads:
            return Written()
        lines = [row.line for row in table.schema_lines(changes).collect()]
        return self._until_sent(
            f"schemas of {table.name}", lambda: self.writer.insert(PAYLOAD_SCHEMAS, lines)
        )

    def _until_sent(self, what: str, send: Callable[[], Written]) -> Written:
        """Sends again until nothing is left unsent, waiting longer each time; the dedup tokens
        drop what already landed."""
        delays = iter(WRITE_RETRY_DELAYS)
        while True:
            written = send()
            if not written.unfinished:
                return written

            delay = next(delays, None)
            if delay is None:
                raise StoreUnavailable(
                    f"{written.unfinished} {what} not sent after {len(WRITE_RETRY_DELAYS) + 1} attempts"
                )
            print(
                f"[serving store] Reload: {written.unfinished} {what} not sent, sending them again in {delay} s",
                flush=True,
            )
            time.sleep(delay)

    def _newest_stored_version(self, table: StoreTable) -> int:
        """The newest commit the store holds of the table, in its rows, its derived tables or its
        payload schemas."""
        database = self.writer.database
        newest = [
            f"(SELECT max(_commit_version) FROM {database}.{store_table})"
            for store_table in (table.name, *table.derived_tables)
        ]
        parameters = {}
        if table.payloads:
            newest.append(
                f"(SELECT max(_commit_version) FROM {database}.{PAYLOAD_SCHEMAS} WHERE table_type = {{table_type:String}})"
            )
            parameters["table_type"] = table.table_type
        # greatest takes two values or more; no commit is below 0.
        [row] = self.writer.query(
            f"SELECT greatest({', '.join(newest)}, 0) AS newest FORMAT JSONEachRow", **parameters
        )
        return int(row["newest"])

    def _check_removal(self, table: StoreTable, version: int, experiment_id: str | None) -> None:
        """Stops before the delete when it would take more than ``REMOVAL_LIMIT`` rows the source
        no longer holds. After the load, a key it holds has its newest copy at the version, so the
        keys still older are the ones the delete removes for good."""
        removed = {
            row[table.counted_by]: int(row["older"])
            for row in self._stored_rows(table, version, experiment_id)
            if int(row["older"])
        }
        total = sum(removed.values())
        if total <= REMOVAL_LIMIT:
            return

        largest = sorted(removed.items(), key=lambda item: item[1], reverse=True)[:20]
        source = self._source_name(table)
        raise RemovalOverLimit(
            f"the delete would remove {total} rows of store.{table.name} that {source} "
            f"no longer holds, over the limit of {REMOVAL_LIMIT}: "
            + ", ".join(f"{experiment} ({count})" for experiment, count in largest)
            + f". Nothing was deleted. If {source} is being refreshed, wait for it; if the rows should go, "
            "run again with ALLOW_REMOVAL set to true (docs/runbooks/procedures/serving-store-reload.md)"
        )

    def _delete_older(
        self, store_table: str, version: int, experiment_id: str | None, **matches: str
    ) -> None:
        """Deletes a store table's rows from before ``version``, of the experiment and with the
        column values in ``matches``. The delete returns once every part is marked, so the count
        after it sees the result."""
        scope, parameters = self._scope(experiment_id)
        scope += "".join(f" AND {column} = {{{column}:String}}" for column in matches)
        self.writer.query(
            f"DELETE FROM {self.writer.database}.{store_table} WHERE _commit_version < {{version:Int64}}{scope}",
            version=version,
            **parameters,
            **matches,
        )

    def _prune_ids(self, experiment_id: str | None) -> None:
        """Removes the contributor and client ids no row names any longer. The views that fill the
        id tables add an id as a row lands and never take one away, so after a delete an id whose
        rows are gone, such as an erased contributor's, would still be listed."""
        scope, parameters = self._scope(experiment_id)
        database = self.writer.database
        for id_table, (column, sources) in ID_SOURCES.items():
            # One NOT IN per table: a mutation refuses a UNION.
            still_named = "".join(
                f" AND (experiment_id, {column}) NOT IN (SELECT experiment_id, assumeNotNull({source_column}) "
                f"FROM {database}.{source} WHERE {source_column} IS NOT NULL{scope})"
                for source, source_column in sources.items()
            )
            self.writer.query(f"DELETE FROM {database}.{id_table} WHERE 1{scope}{still_named}", **parameters)

    def _retire_older(self, copy: str, version: int, experiment_id: str | None) -> None:
        """Marks replaced, at the version and with a settle's stamp, every client's row of a copy by
        device whose newest commit is from before ``version``, then deletes the copy's older rows. A
        settle the writer gave up on, which started before the mark and lands after the delete, loses
        to the mark however late it lands.

        The rows are chosen by their newest commit, not through FINAL: FINAL hides a client's row
        another client replaced, which a stalled settle could then bring back, and shows a capture's
        older settled row over one the feed has just added again above the version and not yet
        settled, which the mark would then hide."""
        scope, parameters = self._scope(experiment_id)
        database = self.writer.database
        [stamp] = self.writer.query("SELECT toUnixTimestamp64Nano(now64(9)) AS stamp FORMAT JSONEachRow")
        self.writer.query(
            f"INSERT INTO {database}.{copy} "
            "(client_id, timestamp, id, experiment_id, device_id, _commit_version, is_replaced, _settle_version) "
            "SELECT client_id, timestamp, id, experiment_id, any(device_id), {version:Int64}, 1, {stamp:UInt64} "
            f"FROM {database}.{copy} WHERE 1{scope} "
            "GROUP BY client_id, timestamp, id, experiment_id, ifNull(device_id, '') "
            "HAVING max(_commit_version) < {version:Int64} "
            # A group of replaced rows alone, the newest stamped before any settle still in flight
            # could have started, such as an earlier reload's marks, is left to the delete rather than
            # marked again on every reload. A newer one may be a client another client replaced, whose
            # stalled settle the mark must still outrank.
            "AND (min(is_replaced) = 0 OR max(_settle_version) > {in_flight_from:UInt64}) "
            # Grouped in the copy's sorting order, which holds the keys of overlapping parts rather
            # than of the whole copy, though a copy in many large overlapping parts still takes GiBs.
            "SETTINGS insert_deduplicate = 0, throw_on_max_partitions_per_insert_block = 0, "
            "optimize_aggregation_in_order = 1",
            version=version,
            stamp=stamp["stamp"],
            in_flight_from=int(stamp["stamp"]) - SETTLE_IN_FLIGHT_NS,
            **parameters,
        )
        self._delete_older(copy, version, experiment_id)

    def _unmatched_copies(self, table: StoreTable, version: int, experiment_id: str | None) -> dict[str, int]:
        """Per experiment whose copies by device do not hold the captures and clients the table holds
        with a client, at the version or older, how many more rows the copies hold: 0 when only which
        ones differ. A settle that never ran, or one that landed after the retirement, shows here.
        Both sides leave out rows newer than the version, but a capture the feed sent a newer copy of
        between its insert and its settle still shows its older device row, so the check can fail a
        healthy reload, which a rerun then passes."""
        scope, parameters = self._scope(experiment_id)
        database = self.writer.database
        capture = "cityHash64(timestamp, id, ifNull(device_id, ''), {client})"
        unmatched: dict[str, int] = {}
        for copy in table.derived_tables:
            rows = self.writer.query(
                "SELECT experiment_id, countIf(copied) - countIf(NOT copied) AS extra, "
                "sumIf(capture, copied) != sumIf(capture, NOT copied) AS different FROM ("
                f"SELECT experiment_id, false AS copied, {capture.format(client='assumeNotNull(client_id)')} "
                f"AS capture FROM {database}.{table.name} FINAL "
                f"WHERE client_id IS NOT NULL AND _commit_version <= {{version:Int64}}{scope} UNION ALL "
                f"SELECT experiment_id, true, {capture.format(client='client_id')} FROM {database}.{copy} FINAL "
                f"WHERE _commit_version <= {{version:Int64}}{scope}) "
                "GROUP BY experiment_id HAVING extra != 0 OR different "
                "SETTINGS max_memory_usage = 4294967296 FORMAT JSONEachRow",
                version=version,
                **parameters,
            )
            for row in rows:
                unmatched[row["experiment_id"]] = unmatched.get(row["experiment_id"], 0) + int(row["extra"])
        return unmatched

    def _stored_rows(self, table: StoreTable, version: int, experiment_id: str | None) -> list[dict]:
        """The store's rows per experiment, or per device, one per key, counted by where each one's
        newest commit falls against ``version``. A row older than it came back after the delete,
        from a feed still catching up on commits before the version."""
        scope, parameters = self._scope(experiment_id)
        return self.writer.query(
            f"SELECT {table.counted_by}, countIf(_commit_version >= {{version:Int64}}) AS current, "
            "countIf(_commit_version > {version:Int64}) AS newer, "
            "countIf(_commit_version < {version:Int64}) AS older "
            f"FROM {self.writer.database}.{table.name} FINAL WHERE 1{scope} GROUP BY {table.counted_by} "
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
