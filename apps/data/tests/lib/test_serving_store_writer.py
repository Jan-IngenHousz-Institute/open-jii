"""The serving store writer: chunked inserts with dedup tokens, a store that cannot take an insert
handed back to the caller, and rows the store cannot read set aside while the rest land."""

from __future__ import annotations

import hashlib
import json
import threading
from collections.abc import Iterator
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import ClassVar
from urllib.parse import parse_qs, urlparse

import pytest
import requests
import responses
from openjii.serving_store import writer
from openjii.serving_store.writer import StoreUnavailable, StoreWriter, Written, storable
from pyspark.sql import DataFrame, SparkSession

URL = "http://store.test/"


@pytest.fixture(autouse=True)
def no_retry_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(writer, "EXECUTOR_RETRY_DELAYS", (0, 0, 0, 0, 0))


@pytest.fixture
def store() -> StoreWriter:
    return StoreWriter(URL, "openjii_writer", "secret")


def _inserts() -> list[tuple[str, str, list[str]]]:
    """Each insert the stub accepted, as its table, dedup token and lines."""
    inserts = []
    for call in responses.calls:
        if getattr(call.response, "status_code", None) != 200:
            continue
        url = call.request.url
        assert isinstance(url, str)
        params = parse_qs(urlparse(url).query)
        table = params["query"][0].split()[2]
        body = call.request.body
        assert isinstance(body, bytes)
        inserts.append((table, params.get("insert_deduplication_token", [""])[0], body.decode().split("\n")))
    return inserts


def _lines(count: int) -> list[str]:
    return [json.dumps({"id": index, "_commit_version": 3}) for index in range(count)]


@responses.activate
def test_lines_go_in_chunks_of_at_most_5000_rows(store: StoreWriter) -> None:
    responses.add(responses.POST, URL)

    written = store.insert("measurements", _lines(12_001))

    assert written == Written(inserted=12_001)
    assert [len(lines) for _, _, lines in _inserts()] == [5_000, 5_000, 2_001]


@responses.activate
def test_a_chunk_stays_under_its_byte_budget_in_bytes(
    store: StoreWriter, monkeypatch: pytest.MonkeyPatch
) -> None:
    # 37 characters of which 20 take two bytes: two fit in 80 characters, but only one in 80 bytes.
    monkeypatch.setattr(writer, "CHUNK_BYTES", 80)
    responses.add(responses.POST, URL)

    store.insert("measurements", ['{"id":1,"pad":"' + "é" * 20 + '"}'] * 3)

    assert [len(lines) for _, _, lines in _inserts()] == [1, 1, 1]


@responses.activate
def test_the_token_is_the_bodys_hash_so_a_replay_repeats_it(store: StoreWriter) -> None:
    responses.add(responses.POST, URL)
    lines = _lines(3)

    store.insert("uploads", lines)
    store.insert("uploads", lines)

    body = "\n".join(lines).encode()
    expected = hashlib.sha256(body).hexdigest()
    assert [token for _, token, _ in _inserts()] == [expected, expected]


@responses.activate
def test_a_partition_is_posted_chunk_by_chunk_as_it_arrives(store: StoreWriter) -> None:
    read = 0
    read_at_each_insert: list[int] = []

    def partition() -> Iterator[str]:
        nonlocal read
        for line in _lines(12_001):
            read += 1
            yield line

    def accept(request: requests.PreparedRequest) -> tuple[int, dict, str]:
        read_at_each_insert.append(read)
        return 200, {}, ""

    responses.add_callback(responses.POST, URL, callback=accept)

    assert store.insert("measurements", partition()) == Written(inserted=12_001)
    # A chunk goes once the next line would not fit, before the rest of the partition is read.
    assert read_at_each_insert == [5_001, 10_001, 12_001]


@responses.activate
def test_a_busy_store_is_waited_out_within_the_executors_attempts(store: StoreWriter) -> None:
    responses.add(responses.POST, URL, status=500, headers={"X-ClickHouse-Exception-Code": "241"})
    responses.add(responses.POST, URL, status=500, headers={"X-ClickHouse-Exception-Code": "252"})
    responses.add(responses.POST, URL)

    written = store.insert("measurements", _lines(4))

    assert written == Written(inserted=4)
    assert len(responses.calls) == 3


@pytest.mark.parametrize(
    "silence", [requests.ConnectionError("connection refused"), requests.ReadTimeout("read timed out")]
)
@responses.activate
def test_a_store_that_does_not_answer_gets_its_rows_handed_back_at_once(
    store: StoreWriter, silence: requests.RequestException
) -> None:
    responses.add(responses.POST, URL)
    responses.add(responses.POST, URL, body=silence)

    written = store.insert("measurements", _lines(6_000))

    assert written == Written(inserted=5_000, unfinished=1_000)
    assert len(responses.calls) == 2


@responses.activate
def test_a_store_that_stays_down_gets_its_rows_handed_back_not_waited_for(store: StoreWriter) -> None:
    responses.add(responses.POST, URL)
    responses.add(responses.POST, URL, status=500, headers={"X-ClickHouse-Exception-Code": "241"})

    written = store.insert("measurements", _lines(6_000))

    # The first chunk landed; the second failed every attempt, and nothing raised.
    assert written == Written(inserted=5_000, unfinished=1_000)
    assert len(responses.calls) == 1 + len(writer.EXECUTOR_RETRY_DELAYS) + 1


@responses.activate
def test_a_code_the_writer_does_not_know_is_retried_rather_than_rejected(store: StoreWriter) -> None:
    responses.add(responses.POST, URL, status=500, headers={"X-ClickHouse-Exception-Code": "999"})
    responses.add(responses.POST, URL)

    assert store.insert("measurements", _lines(2)) == Written(inserted=2)


@pytest.mark.parametrize(
    ("status", "code", "text"),
    [
        (404, "60", "Code: 60. DB::Exception: Table store.measurements does not exist. (UNKNOWN_TABLE)"),
        (
            400,
            "117",
            "Code: 117. DB::Exception: Unknown field found while parsing JSONEachRow format: "
            "client_os_release: (at row 1)",
        ),
    ],
)
@responses.activate
def test_a_table_or_field_the_store_lacks_hands_the_rows_back_at_once(
    store: StoreWriter, status: int, code: str, text: str
) -> None:
    responses.add(
        responses.POST, URL, status=status, headers={"X-ClickHouse-Exception-Code": code}, body=text
    )

    written = store.insert("measurements", _lines(6_000))

    assert written == Written(unfinished=6_000)
    assert len(responses.calls) == 1


def _refuse_bad_rows(request: requests.PreparedRequest) -> tuple[int, dict, str]:
    body = request.body
    assert isinstance(body, bytes) and request.url is not None
    if b'"bad' in body and "feed_rejects" not in request.url:
        return 400, {"X-ClickHouse-Exception-Code": "117"}, "Code: 117. DB::Exception: Cannot parse input"
    return 200, {}, ""


@responses.activate
def test_rows_the_store_cannot_read_are_set_aside_in_one_insert_and_the_rest_land(store: StoreWriter) -> None:
    responses.add_callback(responses.POST, URL, callback=_refuse_bad_rows)
    lines = _lines(8)
    lines[2] = json.dumps({"id": "bad-2", "_commit_version": 4})
    lines[5] = json.dumps({"id": "bad-5", "_commit_version": 4})

    written = store.insert("measurements", lines)

    assert written == Written(inserted=6, rejected=2)
    landed = [
        json.loads(line) for table, _, chunk in _inserts() if table == "store.measurements" for line in chunk
    ]
    reject_inserts = [chunk for table, _, chunk in _inserts() if table == "store.feed_rejects"]
    assert sorted(row["id"] for row in landed) == [0, 1, 3, 4, 6, 7]
    assert len(reject_inserts) == 1
    assert [json.loads(line) for line in reject_inserts[0]] == [
        {
            "source_table": "measurements",
            "commit_version": 4,
            "code": 117,
            "message": "Code: 117. DB::Exception: Cannot parse input",
            "row": line,
        }
        for line in (lines[2], lines[5])
    ]


@responses.activate
def test_a_rejected_row_too_long_to_keep_whole_is_cut_and_says_so(
    store: StoreWriter, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(writer, "_REJECT_ROW_CHARS", 40)
    responses.add_callback(responses.POST, URL, callback=_refuse_bad_rows)
    line = json.dumps({"id": "bad", "_commit_version": 4, "pad": "x" * 40})

    assert store.insert("measurements", [line]) == Written(rejected=1)

    [[reject]] = [chunk for table, _, chunk in _inserts() if table == "store.feed_rejects"]
    assert json.loads(reject)["row"] == line[:40]
    assert json.loads(reject)["message"].endswith(f"(row cut to its first 40 of {len(line)} characters)")


@responses.activate
def test_the_driver_check_queries_as_the_writer(store: StoreWriter) -> None:
    responses.add(responses.GET, URL, body="1\n")

    store.check()

    [call] = responses.calls
    assert parse_qs(urlparse(str(call.request.url)).query) == {"query": ["SELECT 1"]}
    assert call.request.headers["X-ClickHouse-User"] == "openjii_writer"
    assert call.request.headers["X-ClickHouse-Key"] == "secret"


@pytest.mark.parametrize(
    "answer",
    [
        {"body": requests.ConnectionError("connection refused")},
        {"status": 516, "headers": {"X-ClickHouse-Exception-Code": "516"}, "body": "Authentication failed"},
    ],
)
@responses.activate
def test_the_driver_check_fails_on_silence_or_an_error(store: StoreWriter, answer: dict) -> None:
    responses.add(responses.GET, URL, **answer)

    with pytest.raises(StoreUnavailable):
        store.check()


def test_integers_the_store_cannot_hold_become_floats_and_nothing_else_changes() -> None:
    assert json.loads(storable('{"j":{"w":18446744073709551616,"n":-9223372036854775809}}')) == {
        "j": {"w": 1.8446744073709552e19, "n": -9.223372036854776e18}
    }
    assert json.loads(storable('{"j":[1,123456789012345678901234,{"deep":-99999999999999999999}]}')) == {
        "j": [1, 1.2345678901234569e23, {"deep": -1e20}]
    }

    at_the_limits = '{"j":{"u":18446744073709551615,"i":-9223372036854775808}}'
    in_a_string = '{"data":"[{\\"serial\\":\\"12345678901234567890123\\"}]"}'
    short = '{"id":1234567890123}'
    assert json.loads(storable(at_the_limits)) == json.loads(at_the_limits)
    assert json.loads(storable(in_a_string)) == json.loads(in_a_string)
    assert storable(short) is short


class _Recorder(BaseHTTPRequestHandler):
    """A stand-in store that takes every insert and records its token and body."""

    received: ClassVar[list[tuple[str, bytes]]] = []

    def do_POST(self) -> None:
        token = parse_qs(urlparse(self.path).query)["insert_deduplication_token"][0]
        body = self.rfile.read(int(self.headers["Content-Length"]))
        self.received.append((token, body))
        self.send_response(200)
        self.end_headers()

    def log_message(self, *args: object) -> None:
        pass


@pytest.fixture
def recording_store() -> Iterator[tuple[str, list[tuple[str, bytes]]]]:
    """A store reachable from Spark's executors, which run in processes a patched client cannot see."""
    received: list[tuple[str, bytes]] = []
    handler = type("Handler", (_Recorder,), {"received": received})
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    yield f"http://127.0.0.1:{server.server_address[1]}/", received

    server.shutdown()
    server.server_close()


def _batch(spark: SparkSession, count: int) -> DataFrame:
    """Lines over 24 months whose order as text is not their order in time, like gold's, which
    start with ids."""
    rows = []
    for index in range(count):
        month = index % 24
        line = json.dumps({"id": index, "month": month, "_commit_version": 3})
        rows.append((line, datetime(2024 + month // 12, month % 12 + 1, 1)))
    return spark.createDataFrame(rows, "line string, partition_time timestamp")


@pytest.mark.spark
def test_a_batch_posts_the_same_chunks_however_its_input_is_partitioned(
    spark: SparkSession, recording_store: tuple[str, list[tuple[str, bytes]]]
) -> None:
    url, received = recording_store
    batch = _batch(spark, 2_000)

    first = StoreWriter(url, "openjii_writer", "secret").write(batch.repartition(1), "measurements")
    first_inserts = sorted(received)
    received.clear()
    replay = StoreWriter(url, "openjii_writer", "secret").write(batch.repartition(7), "measurements")

    assert first == replay == Written(inserted=2_000)
    assert sorted(received) == first_inserts
    sent = [line for _, body in first_inserts for line in body.decode().split("\n")]
    assert sorted(sent) == sorted(row.line for row in batch.collect())


@pytest.mark.spark
def test_a_chunk_holds_its_rows_in_time_order_so_its_insert_writes_few_months(
    spark: SparkSession, recording_store: tuple[str, list[tuple[str, bytes]]]
) -> None:
    url, received = recording_store

    StoreWriter(url, "openjii_writer", "secret").write(_batch(spark, 2_000), "measurements")

    assert received
    for _, body in received:
        months = [json.loads(line)["month"] for line in body.decode().split("\n")]
        assert months == sorted(months)
