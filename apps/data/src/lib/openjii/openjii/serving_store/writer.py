"""Inserts JSON lines into the serving store over HTTP, each chunk once, and never lets a row the
store cannot read fail the rest of its batch."""

from __future__ import annotations

import hashlib
import json
import re
import time
from collections.abc import Iterable, Iterator
from dataclasses import dataclass

import pandas as pd
import requests
from pyspark.sql import DataFrame
from pyspark.sql import functions as F

# One chunk is one insert block, so it lands whole or not at all.
CHUNK_ROWS = 5_000
CHUNK_BYTES = 8_000_000

# A batch is posted from this many partitions, hashed and sorted by line, so a replayed batch builds
# the same chunks, and so the same dedup tokens, on a cluster of any size.
WRITE_PARTITIONS = 4

# Waits between an executor's attempts at one insert. After the last, it hands its rows back rather
# than hold a task slot the pipeline's ingestion needs; the sink then waits on the driver.
EXECUTOR_RETRY_DELAYS = (1, 2, 5, 10, 15)

# The store could not read the body. Anything else (memory, too many parts, a timeout, a wrong
# password, a missing table) is the store's state or configuration, and waiting it out is right.
BAD_DATA_CODES = frozenset({6, 26, 27, 32, 33, 38, 41, 53, 69, 70, 72, 117, 130, 131, 349})

_LONG_DIGITS = re.compile(r"\d{19,}")
_REJECT_MESSAGE_CHARS = 4_000


def storable(line: str) -> str:
    """The line with every integer outside Int64 and UInt64 written as a float.

    One such integer anywhere in a JSON column fails the whole insert, and Spark keeps them verbatim.
    Only a line with a run of 19 digits can hold one, so the rest pass untouched; digits inside
    strings stay as they are.
    """
    if not _LONG_DIGITS.search(line):
        return line
    return json.dumps(json.loads(line, parse_int=_storable_int), separators=(",", ":"), allow_nan=True)


def _storable_int(text: str) -> int | float:
    value = int(text)
    return value if -(2**63) <= value <= 2**64 - 1 else float(value)


class StoreRefusedData(Exception):
    """The store could not read an insert's body."""

    def __init__(self, code: int, message: str):
        super().__init__(message)
        self.code = code


class StoreUnavailable(Exception):
    """The store did not take an insert within an executor's attempts."""


@dataclass(frozen=True)
class Written:
    inserted: int = 0
    rejected: int = 0
    # Rows not sent because the store was unavailable; whoever wrote them writes them again.
    unfinished: int = 0

    def __add__(self, other: Written) -> Written:
        return Written(
            self.inserted + other.inserted,
            self.rejected + other.rejected,
            self.unfinished + other.unfinished,
        )


class StoreWriter:
    """Writes JSON lines to one database of the store, from Spark executors or in process."""

    def __init__(self, url: str, user: str, key: str, database: str = "store", loader: str = "feed"):
        self.url = url
        self.user = user
        self.key = key
        self.database = database
        # Part of every dedup token, so a reload's inserts never collide with the feed's.
        self.loader = loader
        self._session: requests.Session | None = None

    def __getstate__(self) -> dict:
        # Each executor opens its own connections.
        return {**self.__dict__, "_session": None}

    @property
    def session(self) -> requests.Session:
        if self._session is None:
            self._session = requests.Session()
        return self._session

    def write(self, lines: DataFrame, table: str) -> Written:
        """Inserts ``lines`` (one JSON line per row, in column ``line``) from the executors."""
        writer = self

        def insert_partition(frames: Iterable[pd.DataFrame]) -> Iterator[pd.DataFrame]:
            written = writer.insert(table, [line for frame in frames for line in frame["line"]])
            yield pd.DataFrame(
                {
                    "inserted": [written.inserted],
                    "rejected": [written.rejected],
                    "unfinished": [written.unfinished],
                }
            )

        partitioned = lines.repartition(WRITE_PARTITIONS, F.xxhash64("line")).sortWithinPartitions("line")
        [(inserted, rejected, unfinished)] = (
            partitioned.mapInPandas(insert_partition, "inserted long, rejected long, unfinished long")
            .agg(F.sum("inserted"), F.sum("rejected"), F.sum("unfinished"))
            .collect()
        )
        return Written(inserted or 0, rejected or 0, unfinished or 0)

    def insert(self, table: str, lines: list[str]) -> Written:
        chunks = list(self._chunks([storable(line) for line in lines]))
        written = Written()
        for index, chunk in enumerate(chunks):
            try:
                written += self._insert_chunk(table, chunk)
            except StoreUnavailable as error:
                unfinished = sum(len(rest) for rest in chunks[index:])
                print(f"[serving store] Handing {unfinished} rows of {table} back: {error}", flush=True)
                return written + Written(unfinished=unfinished)
        return written

    def _chunks(self, lines: list[str]) -> Iterator[list[str]]:
        chunk: list[str] = []
        size = 0
        for line in lines:
            line_bytes = len(line.encode())
            if chunk and (len(chunk) >= CHUNK_ROWS or size + line_bytes > CHUNK_BYTES):
                yield chunk
                chunk, size = [], 0
            chunk.append(line)
            size += line_bytes + 1
        if chunk:
            yield chunk

    def _insert_chunk(self, table: str, chunk: list[str]) -> Written:
        """Inserts the chunk, and every row of it the store cannot read into ``feed_rejects`` with
        one insert."""
        rejects: list[tuple[str, StoreRefusedData]] = []
        inserted = self._insert_or_split(table, chunk, rejects)
        if rejects:
            self._insert("feed_rejects", [self._reject_line(table, line, error) for line, error in rejects])
            print(
                f"[serving store] The store refused {len(rejects)} rows of {table}; they are in feed_rejects",
                flush=True,
            )
        return Written(inserted=inserted, rejected=len(rejects))

    def _insert_or_split(
        self, table: str, chunk: list[str], rejects: list[tuple[str, StoreRefusedData]]
    ) -> int:
        """Inserts the chunk, halving it until each row the store cannot read stands alone in
        ``rejects``; returns how many rows landed."""
        try:
            self._insert(table, chunk)
            return len(chunk)
        except StoreRefusedData as error:
            if len(chunk) == 1:
                rejects.append((chunk[0], error))
                return 0
            middle = len(chunk) // 2
            return self._insert_or_split(table, chunk[:middle], rejects) + self._insert_or_split(
                table, chunk[middle:], rejects
            )

    def _insert(self, table: str, lines: list[str]) -> None:
        """Inserts the body, raising StoreRefusedData when the store cannot read it and
        StoreUnavailable when it does not take it within the executor's attempts."""
        body = "\n".join(lines).encode()
        params = {
            "query": f"INSERT INTO {self.database}.{table} FORMAT JSONEachRow",
            # A replayed batch sends the same bodies, and the store drops a token it has seen.
            "insert_deduplication_token": f"{self.loader}:{table}:{hashlib.sha256(body).hexdigest()}",
            # Rows from many months in one insert are normal after an outage.
            "throw_on_max_partitions_per_insert_block": "0",
        }
        headers = {"X-ClickHouse-User": self.user, "X-ClickHouse-Key": self.key}

        for attempt, delay in enumerate((*EXECUTOR_RETRY_DELAYS, None), start=1):
            try:
                response = self.session.post(
                    self.url, params=params, data=body, headers=headers, timeout=(10, 300)
                )
            except requests.RequestException as error:
                failure = f"{type(error).__name__}: {error}"
            else:
                if response.ok:
                    return
                # The HTTP status cannot tell bad data from a busy store; the exception code can.
                code = int(response.headers.get("X-ClickHouse-Exception-Code", "0"))
                if code in BAD_DATA_CODES:
                    raise StoreRefusedData(code, response.text)
                failure = f"HTTP {response.status_code}, code {code}: {response.text[:300]}"

            if delay is None:
                raise StoreUnavailable(f"insert into {table} failed {attempt} times, last: {failure}")
            # Printed, since pipelines capture stdout and often drop the logging module's output.
            print(
                f"[serving store] Insert into {table} failed on attempt {attempt}, retrying in {delay} s: {failure}",
                flush=True,
            )
            time.sleep(delay)

    def _reject_line(self, table: str, line: str, error: StoreRefusedData) -> str:
        return json.dumps(
            {
                "source_table": table,
                "commit_version": json.loads(line)["_commit_version"],
                "code": error.code,
                "message": str(error)[:_REJECT_MESSAGE_CHARS],
                "row": line,
            }
        )
