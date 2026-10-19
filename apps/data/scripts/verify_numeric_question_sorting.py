#!/usr/bin/env python3
"""Run `pnpm --filter data verify:numeric-question-sorting` from the repo root.

Uses the data workspace's pinned Spark runtime and Java 17/21. Executes current
backend repository/adapter SQL over synthetic local parquet VARIANT tables.
--skip-perf runs correctness only; --output saves SQL, responses and timings.
See apps/data/README.md for setup, precision policy and verification limits.
"""

import argparse
import json
import os
import re
import statistics
import subprocess
import tempfile
import threading
import time
from decimal import Decimal, localcontext
from functools import cmp_to_key
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from itertools import pairwise
from pathlib import Path

from pyspark.sql import SparkSession
from pyspark.sql import functions as F

ROOT = Path(__file__).resolve().parents[3]
ASCII_SPACE = "\t\n\v\f\r "
GRAMMAR = re.compile(r"[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)")
ANSWERS = [
    "1",
    "10",
    "100",
    "2",
    "001",
    "1.0",
    "1",
    "-2",
    "+2",
    ".5",
    "1.",
    "0",
    "-0",
    "+0",
    "0.0",
    "-.0",
    " 002 ",
    "\t-1.5\n",
    "\v3\f",
    "\r4\t",
    "9007199254740993",
    "9007199254740992",
    "-99999999999999999999",
    "99999999999999999999",
    "99999999999999999999.999999999999999999",
    "-99999999999999999999.999999999999999999",
    "0.000000000000000001",
    "0.000000000000000002",
    "-0.000000000000000001",
    "-0.000000000000000002",
    "100000000000000000000",
    "-100000000000000000000",
    "000000000000000000000000000000002",
    "0.0000000000000000001",
    "1.0000000000000000001",
    "0.9999999999999999999",
    "1.000000000000000000000000000000000000",
    "1.1234567890123456780000000000000000",
    ".",
    "+",
    "-",
    "+-1",
    "--1",
    "1.2.3",
    "1 2",
    "1e3",
    "1E-3",
    "0x1F",
    "1,000",
    "1_000",
    "12abc",
    "NaN",
    "-Infinity",
    "inf",
    "٣",
    "\uff11\uff12",
    "\u00a0",
    "\u00a01\u00a0",
    "apple",
    "pear",
    "",
    " ",
    "\t",
    "\n",
    "\v",
    "\f",
    "\r",
    None,
]
BASIC = ["1", "10", "100", "2", "001", "1", "1.0", "", "\t", None]
ODD_FIELD = "a.b`c'\"; DROP TABLE nope"
BASE_COLUMNS = [
    "id",
    "experiment_id",
    "timestamp",
    "base_text",
    "base_number",
    "questions_data",
    "custom_metadata",
]
MACRO_COLUMNS = [
    *BASE_COLUMNS,
    "macro_output",
    "macro_id",
    "raw_id",
    "macro_name",
    "macro_filename",
    "date",
]
# The builder's first-choice sort key names, and source columns that clash with them in any case.
SORT_KEYS = [
    "__numeric_order_group",
    "__numeric_order_decimal",
    "__numeric_order_value",
    "__numeric_order_row",
]
BASE_COLLISIONS = [
    "__Numeric_Order_Group",
    "__NUMERIC_ORDER_DECIMAL",
    "__numeric_order_Value",
    "__numeric_order_row",
    "__numeric_order_value_1",
]
QUESTION_COLLISIONS = "OBJECT<" + ", ".join(f"{name}: STRING" for name in ["answer", *SORT_KEYS]) + ">"
# Benchmark reads per projection and page shape; the deep page and chart read keep their OFFSET
# and LIMIT exactly as the repository emits them.
PERF_CELLS = {
    ("ids", "first"): {"rowCount": 200001, "options": {"page": 1, "pageSize": 100}},
    ("ids", "deep"): {"rowCount": 200001, "options": {"page": 1001, "pageSize": 100}},
    ("ids", "chart"): {"options": {"columns": ["id"], "limit": 100000}},
    ("payload", "first"): {"options": {"page": 1, "pageSize": 100}},
    ("payload", "deep"): {"options": {"page": 1001, "pageSize": 100}},
    ("payload", "chart"): {"options": {"columns": ["id", "answer"], "limit": 100000}},
}
PERF_ROWS = {"first": 100, "deep": 100, "chart": 100001}
PERF_SAMPLES = 5
UPLOAD_COLUMNS = [
    "id",
    "experiment_id",
    "uploaded_data",
    "custom_metadata",
    "upload_table_id",
    "upload_table_name",
    "upload_id",
]


def classification(value):
    if value is None or value.strip(ASCII_SPACE) == "":
        return 2, None
    clean = value.strip(ASCII_SPACE)
    if GRAMMAR.fullmatch(clean):
        integer, _, fraction = clean.lstrip("+-").partition(".")
        if len(integer.lstrip("0")) <= 20 and len(fraction.rstrip("0")) <= 18:
            return 0, Decimal(clean)
    return 1, None


def comparator(direction="ASC"):
    def compare(left, right):
        li, lv = left
        ri, rv = right
        lg, ln = classification(lv)
        rg, rn = classification(rv)
        if lg != rg:
            return (lg > rg) - (lg < rg)
        sign = 1 if direction == "ASC" else -1
        if lg == 0 and ln != rn:
            return sign * ((ln > rn) - (ln < rn))
        if lv != rv:
            if lv is None or rv is None:
                return 1 if lv is None else -1
            return sign * ((lv > rv) - (lv < rv))
        return (li > ri) - (li < ri)

    return compare


def ordered(answers, direction="ASC"):
    return sorted(enumerate(answers, 1), key=cmp_to_key(comparator(direction)))


def scenarios():
    cases = []

    def add(name, fixture="main", **kwargs):
        cases.append(
            {
                "name": name,
                "fixture": fixture,
                "viewColumns": BASE_COLUMNS,
                "options": {},
                **kwargs,
            }
        )

    for direction in ["ASC", "DESC"]:
        add(
            f"all-{direction}",
            options={
                "page": 1,
                "pageSize": 1000,
                "orderBy": "answer",
                "orderDirection": direction,
            },
        )
        for mode in [
            "page",
            "page-late-payload",
            "filtered-page",
            "filtered-page-late-payload",
        ]:
            for page in [1, 2, 3, 4]:
                options = {
                    "page": page,
                    "pageSize": 3,
                    "orderBy": "answer",
                    "orderDirection": direction,
                }
                if "filtered" in mode:
                    options["filters"] = [{"column": "id", "operator": "greater_than", "value": 0}]
                add(
                    f"{mode}-{direction}-{page}",
                    fixture="basic",
                    rowCount=200001 if "late" in mode else len(BASIC),
                    options=options,
                )
        add(
            f"ids-{direction}",
            fixture="basic",
            rowCount=200001,
            options={
                "columns": ["id"],
                "page": 1,
                "pageSize": 3,
                "orderBy": "answer",
                "orderDirection": direction,
            },
        )
        add(
            f"filtered-all-{direction}",
            fixture="basic",
            options={
                "columns": ["id", "answer"],
                "limit": 4,
                "orderBy": "answer",
                "orderDirection": direction,
            },
        )
        # The endpoint is ASC-only; a repository-produced distinct query is also executed DESC below.
    add("picker", fixture="basic", picker={"column": "answer", "limit": 100})
    add(
        "picker-desc",
        fixture="basic",
        picker={"column": "answer", "limit": 100},
        distinctDirection="DESC",
    )
    add("picker-truncated", fixture="basic", picker={"column": "answer", "limit": 3})
    add(
        "equal-original",
        options={
            "columns": ["id", "answer"],
            "orderBy": "answer",
            "filters": [{"column": "answer", "operator": "equals", "value": "001"}],
        },
    )
    add(
        "contains-original",
        options={
            "columns": ["id", "answer"],
            "orderBy": "answer",
            "filters": [{"column": "answer", "operator": "contains", "value": "00"}],
        },
    )
    add(
        "base-collision",
        fixture="base-collision",
        questionsSchema="OBJECT<base_text: STRING>",
        options={"orderBy": "base_text_answer", "page": 1, "pageSize": 100},
    )
    add(
        "renamed-filter",
        fixture="base-collision",
        questionsSchema="OBJECT<base_text: STRING>",
        options={
            "orderBy": "base_text_answer",
            "columns": ["id", "base_text_answer"],
            "filters": [{"column": "base_text_answer", "operator": "equals", "value": "001"}],
            "page": 1,
            "pageSize": 10,
        },
    )
    add(
        "macro-collision",
        fixture="macro",
        tableType="macro",
        viewColumns=MACRO_COLUMNS,
        macroSchema="OBJECT<answer: STRING, answer_answer: STRING>",
        options={"orderBy": "answer_answer_2", "page": 1, "pageSize": 100},
    )
    add(
        "case-collision",
        fixture="case-collision",
        questionsSchema="OBJECT<BASE_TEXT: STRING>",
        options={"orderBy": "BASE_TEXT_answer", "page": 1, "pageSize": 100},
    )
    escaped = ODD_FIELD.replace("`", "``")
    add(
        "odd-name",
        fixture="odd",
        questionsSchema=f"OBJECT<`{escaped}`: STRING>",
        options={"orderBy": ODD_FIELD, "page": 1, "pageSize": 100},
    )
    for direction in ["ASC", "DESC"]:
        add(
            f"macro-answer-{direction}",
            fixture="macro-simple",
            tableType="macro",
            viewColumns=MACRO_COLUMNS,
            macroSchema="OBJECT<output: STRING>",
            options={
                "orderBy": "answer",
                "orderDirection": direction,
                "page": 1,
                "pageSize": 100,
            },
        )
    for direction in ["ASC", "DESC"]:
        # Every page of the main fixture, across the numeric, text and blank groups, then past it.
        for mode, row_count in [("deep", len(ANSWERS)), ("deep-late-payload", 200001)]:
            for page in range(1, 9):
                add(
                    f"{mode}-{direction}-{page}",
                    rowCount=row_count,
                    options={
                        "page": page,
                        "pageSize": 10,
                        "orderBy": "answer",
                        "orderDirection": direction,
                    },
                )
        add(
            f"oversized-{direction}",
            options={
                "columns": ["id", "answer"],
                "limit": 1000,
                "orderBy": "answer",
                "orderDirection": direction,
            },
        )
        # A chart's read: projected X and Y, user filters, every matching row up to its limit.
        add(
            f"chart-{direction}",
            options={
                "columns": ["id", "answer", "base_number"],
                "filters": [
                    {"column": "base_number", "operator": "greater_than", "value": 1},
                    {"column": "answer", "operator": "contains", "value": "0"},
                ],
                "limit": 20,
                "orderBy": "answer",
                "orderDirection": direction,
            },
        )
        for fixture, extra, field in [
            ("collide-question", {"questionsSchema": QUESTION_COLLISIONS}, SORT_KEYS[0]),
            ("collide-base", {"viewColumns": [*BASE_COLUMNS, *BASE_COLLISIONS]}, BASE_COLLISIONS[0]),
        ]:
            reads = {
                "star": {"page": 1, "pageSize": 100},
                "with-sort": {"columns": ["id", "answer", field], "page": 1, "pageSize": 100},
                "without-sort": {"columns": ["id", field], "page": 1, "pageSize": 100},
                "ids-1": {"page": 1, "pageSize": 4},
                "ids-2": {"page": 2, "pageSize": 4},
            }
            for read, options in reads.items():
                add(
                    f"{fixture}-{read}-{direction}",
                    fixture=fixture,
                    rowCount=200001 if read.startswith("ids") else len(BASIC),
                    options={**options, "orderBy": "answer", "orderDirection": direction},
                    **extra,
                )
            add(
                f"{fixture}-picker-{direction}",
                fixture=fixture,
                picker={"column": "answer", "limit": 100},
                **({"distinctDirection": "DESC"} if direction == "DESC" else {}),
                **extra,
            )
    add(
        "collide-question-by-field",
        fixture="collide-question",
        questionsSchema=QUESTION_COLLISIONS,
        options={"orderBy": SORT_KEYS[2], "page": 1, "pageSize": 100},
    )
    add(
        "aggregate-empty",
        fixture="basic",
        options={"page": 1, "pageSize": 100, "orderBy": "answer", "aggregation": {}},
    )
    # Regression controls for unaffected sources, types and omitted ordering.
    controls = [
        ("no-sort", {}, {}),
        ("empty-sort", {"orderBy": ""}, {}),
        ("base-text", {"orderBy": "base_text"}, {}),
        ("base-number", {"orderBy": "base_number"}, {}),
        (
            "native-bigint",
            {"orderBy": "answer"},
            {"questionsSchema": "OBJECT<answer: BIGINT>"},
        ),
        (
            "native-double",
            {"orderBy": "answer"},
            {"questionsSchema": "OBJECT<answer: DOUBLE>"},
        ),
        (
            "native-boolean",
            {"orderBy": "answer"},
            {"questionsSchema": "OBJECT<answer: BOOLEAN>"},
        ),
        (
            "native-variant",
            {"orderBy": "answer"},
            {"questionsSchema": "OBJECT<answer: VARIANT>", "captureOnly": True},
        ),
        (
            "metadata",
            {"orderBy": "label"},
            {"customMetadataSchema": "OBJECT<label: STRING>"},
        ),
        (
            "macro-output",
            {"orderBy": "answer"},
            {
                "fixture": "macro",
                "tableType": "macro",
                "viewColumns": MACRO_COLUMNS,
                "macroSchema": "OBJECT<answer: STRING, answer_answer: STRING>",
            },
        ),
        (
            "collision-base",
            {"orderBy": "base_text"},
            {
                "fixture": "base-collision",
                "questionsSchema": "OBJECT<base_text: STRING>",
            },
        ),
        (
            "upload",
            {"orderBy": "answer"},
            {
                "fixture": "upload",
                "tableType": "upload",
                "viewColumns": UPLOAD_COLUMNS,
                "uploadSchema": "OBJECT<answer: STRING>",
            },
        ),
        (
            "aggregate",
            {
                "orderBy": "answer",
                "aggregation": {
                    "groupBy": [{"column": "answer"}],
                    "functions": [{"column": "id", "function": "count", "alias": "n"}],
                },
            },
            {},
        ),
    ]
    for name, options, extra in controls:
        add(
            "control-" + name,
            fixture=extra.pop("fixture", "basic"),
            options={"page": 1, "pageSize": 100, **options},
            control=True,
            **extra,
        )
    for (projection, shape), cell in PERF_CELLS.items():
        for direction in ["ASC", "DESC"]:
            for variant in ["numeric", "lexical"]:
                add(
                    perf_name(variant, projection, shape, direction),
                    fixture="basic",
                    rowCount=cell.get("rowCount", len(BASIC)),
                    options={**cell["options"], "orderBy": "answer", "orderDirection": direction},
                    lexical=variant == "lexical",
                )
    return cases


def perf_name(variant, projection, shape, direction):
    return f"perf-{variant}-{projection}-{shape}-{direction}"


class Bridge:
    def __init__(self, spark, cases):
        self.spark = spark
        self.cases = {case["name"]: case for case in cases}
        self.records = []
        self.active = None
        self.lock = threading.Lock()

    def execute(self, scenario, sql):
        with self.lock:
            case = self.cases[scenario]
            if case.get("captureOnly"):
                data = {"columns": [], "rows": [], "totalRows": 0, "truncated": False}
            else:
                fixture = case["fixture"]
                target = {"static": "raw", "macro": "macro", "upload": "upload"}[
                    case.get("tableType", "static")
                ]
                if self.active != (fixture, target):
                    self.spark.sql(
                        f"CREATE OR REPLACE VIEW default.numeric_sort_{target} AS SELECT * FROM default.fixture_{fixture.replace('-', '_')}"
                    )
                    self.active = (fixture, target)
                frame = self.spark.sql(sql)
                rows = [[None if v is None else str(v) for v in row] for row in frame.collect()]
                columns = [
                    {
                        "name": field.name,
                        "type_name": field.dataType.simpleString().upper(),
                        "type_text": field.dataType.simpleString().upper(),
                        "position": i,
                    }
                    for i, field in enumerate(frame.schema)
                ]
                data = {
                    "columns": columns,
                    "rows": rows,
                    "totalRows": len(rows),
                    "truncated": False,
                }
            self.records.append({"scenario": scenario, "sql": sql, "result": data})
            return data

    def run(self, cases):
        bridge = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                try:
                    payload = json.dumps(bridge.execute(body["scenario"], body["sql"])).encode()
                    self.send_response(200)
                except Exception as error:
                    payload = str(error).encode()
                    self.send_response(500)
                self.end_headers()
                self.wfile.write(payload)

            def log_message(self, *_args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as plan:
                json.dump(cases, plan)
                plan.flush()
                env = {
                    **os.environ,
                    "NUMERIC_SORT_BRIDGE": f"http://127.0.0.1:{server.server_port}",
                }
                command = [
                    "pnpm",
                    "--filter",
                    "backend",
                    "exec",
                    "ts-node",
                    "--transpile-only",
                    "--compiler-options",
                    '{"module":"Node16","moduleResolution":"Node16","rootDir":"."}',
                    "scripts/verify-numeric-question-sorting.ts",
                    plan.name,
                ]
                done = subprocess.run(command, cwd=ROOT, env=env, text=True, capture_output=True)
                if done.returncode:
                    raise RuntimeError(done.stdout + done.stderr)
                return json.loads(done.stdout), self.records
        finally:
            server.shutdown()
            server.server_close()


def create_fixtures(spark):
    definitions = {
        "main": ANSWERS,
        "basic": BASIC,
        "base-collision": BASIC,
        "case-collision": BASIC,
        "odd": BASIC,
        "macro": BASIC,
        "macro-simple": BASIC,
        "upload": BASIC,
        "collide-question": BASIC,
        "collide-base": BASIC,
    }

    def questions(name, i, value):
        if name == "collide-question":
            return {
                "answer": value,
                **{key: f"{key}:{i}" for key in SORT_KEYS},
                SORT_KEYS[2]: BASIC[::-1][i - 1],
            }
        field = {
            "base-collision": "base_text",
            "case-collision": "BASE_TEXT",
            "odd": ODD_FIELD,
        }.get(name, "answer")
        return {field: value}

    for name, answers in definitions.items():
        rows = [
            (
                i,
                "fixture-experiment",
                float(i),
                "10" if i % 2 else "2",
                i,
                json.dumps(questions(name, i, value)),
                json.dumps({"label": "10" if i % 2 else "2"}),
                json.dumps({"answer": value, "answer_answer": "untouched", "output": value}),
                "fixture-table",
                i,
                "macro",
                "macro.py",
                "2026-10-15",
                json.dumps({"answer": value}),
                "fixture-table",
                "upload",
                "upload-id",
            )
            for i, value in enumerate(answers, 1)
        ]
        schema = "id long, experiment_id string, timestamp double, base_text string, base_number long, questions_data string, custom_metadata string, macro_output string, macro_id string, raw_id long, macro_name string, macro_filename string, date string, uploaded_data string, upload_table_id string, upload_table_name string, upload_id string"
        frame = spark.createDataFrame(rows, schema)
        # Include an out-of-experiment row, and an out-of-macro row in shared views.
        other = frame.limit(1).withColumn("experiment_id", F.lit("excluded-experiment"))
        frame = frame.unionByName(other)
        if name.startswith("macro"):
            frame = frame.unionByName(frame.limit(1).withColumn("macro_id", F.lit("excluded-macro")))
        variants = [
            "questions_data",
            "custom_metadata",
            "macro_output",
            "uploaded_data",
        ]
        for column in variants:
            frame = frame.withColumn(column, F.parse_json(column))
        columns = (
            UPLOAD_COLUMNS
            if name == "upload"
            else MACRO_COLUMNS
            if name.startswith("macro")
            else BASE_COLUMNS
        )
        if name == "collide-base":
            for column in BASE_COLLISIONS:
                frame = frame.withColumn(column, F.concat(F.lit(column + ":"), F.col("id").cast("string")))
            columns = [*BASE_COLUMNS, *BASE_COLLISIONS]
        frame.select(*columns).write.mode("overwrite").saveAsTable(
            "default.fixture_" + name.replace("-", "_")
        )
    print(
        f"Materialized {len(definitions)} synthetic parquet fixtures: {len(ANSWERS)} main answers, {len(BASIC)} paging answers",
        flush=True,
    )
    # Warm materialized fixtures. All table scans now read VARIANT parquet, not JSON parsing.
    for name in definitions:
        table = "default.fixture_" + name.replace("-", "_")
        spark.table(table).cache().count()


def verify(responses, records):
    def ids(name):
        return [int(row["id"]) for row in responses[name][0]["data"]["rows"]]

    for direction in ["ASC", "DESC"]:
        want_main = [i for i, _ in ordered(ANSWERS, direction)]
        want_basic = [i for i, _ in ordered(BASIC, direction)]
        assert ids(f"all-{direction}") == want_main, (
            direction,
            ids(f"all-{direction}"),
            want_main,
        )
        for mode in [
            "page",
            "page-late-payload",
            "filtered-page",
            "filtered-page-late-payload",
        ]:
            for page in [1, 2, 3, 4]:
                name = f"{mode}-{direction}-{page}"
                assert ids(name) == want_basic[(page - 1) * 3 : page * 3], (
                    name,
                    ids(name),
                    want_basic,
                )
        assert ids(f"ids-{direction}") == want_basic[:3]
        assert ids(f"filtered-all-{direction}") == want_basic[:4]
        all_page = responses[f"filtered-all-{direction}"][0]
        assert all_page["data"]["truncated"] and all_page["totalRows"] == len(BASIC)
        assert [row["answer"] for row in responses[f"all-{direction}"][0]["data"]["rows"]] == [
            value for _, value in ordered(ANSWERS, direction)
        ]
    distinct = list(dict.fromkeys(value for _, value in ordered(BASIC)))
    endpoint = [v for v in distinct if v not in [None, ""]]
    assert responses["picker"] == {"values": endpoint, "truncated": False}
    assert responses["picker-truncated"] == {"values": distinct[:3], "truncated": True}
    assert ids("equal-original") == [5]
    assert ids("renamed-filter") == [5]
    expected_contains = [i for i, value in ordered(ANSWERS) if value is not None and "00" in value]
    assert ids("contains-original") == expected_contains
    for name in [
        "base-collision",
        "case-collision",
        "macro-collision",
        "odd-name",
        "macro-answer-ASC",
    ]:
        assert ids(name) == [i for i, _ in ordered(BASIC)], name
    assert ids("macro-answer-DESC") == [i for i, _ in ordered(BASIC, "DESC")]
    field_by_scenario = {
        "base-collision": "base_text_answer",
        "renamed-filter": "base_text_answer",
        "case-collision": "BASE_TEXT_answer",
        "macro-collision": "answer_answer_2",
        "odd-name": ODD_FIELD,
    }
    # Schema, cardinality and no hidden key leakage for every executed result.
    for record in records:
        name, result = record["scenario"], record["result"]
        assert result["totalRows"] == len(result["rows"])
        names = [c["name"].lower() for c in result["columns"]]
        assert len(names) == len(set(names)), (name, names)
        hidden = sort_key_names(record["sql"])
        assert not hidden.intersection(names), (name, hidden, names)
        if name.startswith("control-") or record["sql"].startswith("SELECT COUNT"):
            continue
        columns = result["columns"]
        field = field_by_scenario.get(name, "answer")
        if any(c["name"] == field for c in columns):
            assert next(c["type_text"] for c in columns if c["name"] == field) == "STRING", name
        if "picker" in name:
            assert len(columns) == 1 and columns[0]["name"] == "answer"
    assert [r["sql"] for r in records if r["scenario"] == "control-empty-sort"] == [
        r["sql"] for r in records if r["scenario"] == "control-no-sort"
    ], "Empty ordering must remain an unordered read"
    verify_sprint_3(responses, records)
    # Endpoint string filtering and aggregation are deliberately unchanged.
    grouped = responses["control-aggregate"][0]["data"]["rows"]
    assert sum(int(row["n"]) for row in grouped) == len(BASIC)
    print(
        f"PASS correctness: {len(responses)} repository scenarios, {len(records)} executed statements",
        flush=True,
    )
    return {"scenarios": len(responses), "statements": len(records)}


def sort_key_names(sql):
    """Lower-cased names the outer query drops, when the read sorts by projected keys."""
    head = re.match(r"SELECT \* EXCEPT \(([^)]*)\)\nFROM \(\n", sql)
    if head is None:
        return set()
    return {name.strip().strip("`").lower() for name in head.group(1).split(",")}


def verify_sprint_3(responses, records):
    def rows(name):
        return responses[name][0]["data"]["rows"]

    def ids(name):
        return [int(row["id"]) for row in rows(name)]

    for direction in ["ASC", "DESC"]:
        main = ordered(ANSWERS, direction)
        basic = [i for i, _ in ordered(BASIC, direction)]
        for mode in ["deep", "deep-late-payload"]:
            for page in range(1, 9):
                name = f"{mode}-{direction}-{page}"
                want = main[(page - 1) * 10 : page * 10]
                assert ids(name) == [i for i, _ in want], (name, ids(name), want)
                assert [row["answer"] for row in rows(name)] == [v for _, v in want], name
        oversized = responses[f"oversized-{direction}"][0]
        assert ids(f"oversized-{direction}") == [i for i, _ in main]
        assert not oversized["data"]["truncated"] and oversized["totalRows"] == len(ANSWERS)
        matching = [(i, v) for i, v in main if i > 1 and v is not None and "0" in v]
        chart = responses[f"chart-{direction}"][0]
        assert [c["name"] for c in chart["data"]["columns"]] == ["id", "answer", "base_number"]
        assert [(int(r["id"]), r["answer"]) for r in rows(f"chart-{direction}")] == matching[:20]
        assert all(r["base_number"] == r["id"] for r in rows(f"chart-{direction}"))
        assert chart["data"]["truncated"] == (len(matching) > 20)
        assert chart["totalRows"] == len(matching)
        endpoint = [v for v in dict.fromkeys(v for _, v in ordered(BASIC, direction)) if v not in [None, ""]]
        for fixture, collisions in [("collide-question", SORT_KEYS), ("collide-base", BASE_COLLISIONS)]:
            for read in ["star", "with-sort", "without-sort"]:
                name = f"{fixture}-{read}-{direction}"
                assert ids(name) == basic, (name, ids(name), basic)
            assert ids(f"{fixture}-ids-1-{direction}") == basic[:4]
            assert ids(f"{fixture}-ids-2-{direction}") == basic[4:8]
            assert responses[f"{fixture}-picker-{direction}"] == {"values": endpoint, "truncated": False}
            star = rows(f"{fixture}-star-{direction}")
            for column in collisions:
                if column == SORT_KEYS[2] and fixture == "collide-question":
                    assert [r[column] for r in star] == [BASIC[::-1][i - 1] for i in basic]
                else:
                    assert [r[column] for r in star] == [f"{column}:{i}" for i in basic], column
            assert [r[collisions[0]] for r in rows(f"{fixture}-without-sort-{direction}")] == [
                f"{collisions[0]}:{i}" for i in basic
            ]
    assert ids("collide-question-by-field") == [i for i, _ in ordered(BASIC[::-1])]
    assert ids("aggregate-empty") == [i for i, _ in ordered(BASIC)]
    presorted = [r for r in records if sort_key_names(r["sql"])]
    assert presorted, "Numeric reads must sort by projected keys"
    for record in records:
        if record["scenario"].startswith(("collide-", "perf-numeric")) and "ORDER BY" in record["sql"]:
            assert sort_key_names(record["sql"]), record["scenario"]


def perf_table(spark, size):
    frame = spark.range(size).selectExpr(
        "id + 1 AS id",
        "'fixture-experiment' AS experiment_id",
        "cast(id AS double) AS timestamp",
        "'label' AS base_text",
        "id AS base_number",
        "parse_json(to_json(named_struct('answer', CASE WHEN id % 10 = 0 THEN '' WHEN id % 10 = 1 THEN 'text' WHEN id % 10 = 2 THEN NULL ELSE cast((id * 17) % 100000 AS string) END))) AS questions_data",
        "parse_json('{}') AS custom_metadata",
    )
    table = f"default.perf_{size}"
    frame.write.mode("overwrite").saveAsTable(table)
    spark.table(table).cache().count()
    spark.sql(f"CREATE OR REPLACE VIEW default.numeric_sort_raw AS SELECT * FROM {table}")
    return table


def perf_statement(statements, name):
    return next(r["sql"] for r in statements if r["scenario"] == name and "ORDER BY" in r["sql"])


def interleaved(spark, variants, samples=PERF_SAMPLES):
    """One warmup per statement, then timed samples taken in turn, so drift hits every variant."""
    results = {label: spark.sql(sql).collect() for label, sql in variants.items()}
    timings = {label: [] for label in variants}
    for _ in range(samples):
        for label, sql in variants.items():
            start = time.perf_counter()
            spark.sql(sql).collect()
            timings[label].append(time.perf_counter() - start)
    return {
        label: {"median": statistics.median(timings[label]), "samples": timings[label]} for label in variants
    }, results


def sort_plan(spark, sql):
    """The physical plan, checked to sort by attributes computed once per row below the sort."""
    plan = spark.sql(sql)._jdf.queryExecution().executedPlan().toString()
    sort = next(line for line in plan.splitlines() if "TakeOrderedAndProject" in line)
    order = sort[sort.index("orderBy=") : sort.index("], output=")]
    assert "RLIKE" not in order and "try_cast" not in order, plan
    assert "__numeric_order_group" in order and "InMemoryTableScan" in plan, plan
    below = plan[plan.index(sort) + len(sort) :]
    assert "Project [" in below and "RLIKE" in below, plan
    return plan


def in_order(rows, direction):
    compare = comparator(direction)
    pairs = [(int(row["id"]), row["answer"]) for row in rows]
    return all(compare(a, b) <= 0 for a, b in pairwise(pairs))


def benchmark(spark, statements):
    """Time repository SQL as emitted, against the same SQL with numeric classification off.
    First pages run at 100k and 1M rows; deep pages and chart reads at 1M."""
    report = []
    for size in [100000, 1000000]:
        table = perf_table(spark, size)
        for (projection, shape), _cell in PERF_CELLS.items():
            if size != 1000000 and shape != "first":
                continue
            for direction in ["ASC", "DESC"]:
                variants = {
                    label: perf_statement(statements, perf_name(label, projection, shape, direction))
                    for label in ["lexical", "numeric"]
                }
                timings, results = interleaved(spark, variants)
                expected_rows = min(PERF_ROWS[shape], size)
                assert len(results["numeric"]) == len(results["lexical"]) == expected_rows, shape
                if projection == "payload":
                    assert in_order(results["numeric"], direction), (shape, direction)
                sort_plan(spark, variants["numeric"])
                lexical, numeric = timings["lexical"]["median"], timings["numeric"]["median"]
                item = {
                    "rows": size,
                    "projection": projection,
                    "shape": shape,
                    "direction": direction,
                    "lexical": lexical,
                    "numeric": numeric,
                    "ratio": numeric / lexical,
                    "delta": numeric - lexical,
                    "samples": {label: t["samples"] for label, t in timings.items()},
                }
                report.append(item)
                print("PERF " + json.dumps(item), flush=True)
        spark.catalog.uncacheTable(table)
    exceeded = [i for i in report if i["rows"] == 1000000 and (i["ratio"] > 5 or i["delta"] > 2)]
    assert not exceeded, ("Performance threshold exceeded; investigate or escalate", exceeded)
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-perf", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    started = time.perf_counter()
    with tempfile.TemporaryDirectory(prefix="numeric-sort-spark-") as warehouse:
        spark = (
            SparkSession.builder.master("local[2]")
            .appName("numeric-question-sorting")
            .config("spark.ui.enabled", "false")
            .config("spark.sql.shuffle.partitions", "2")
            .config("spark.sql.warehouse.dir", warehouse)
            .config("spark.driver.memory", "2g")
            .getOrCreate()
        )
        spark.sparkContext.setLogLevel("ERROR")
        cases = scenarios()
        report = {"spark": spark.version, "runs": []}
        try:
            create_fixtures(spark)
            for ansi in [True, False]:
                spark.conf.set("spark.sql.ansi.enabled", str(ansi).lower())
                print(f"Spark {spark.version}, ANSI={ansi}", flush=True)
                responses, statements = Bridge(spark, cases).run(cases)
                verify(responses, statements)
                for direction, scenario in [("ASC", "picker"), ("DESC", "picker-desc")]:
                    result = next(r["result"] for r in statements if r["scenario"] == scenario)
                    wanted = list(dict.fromkeys(value for _, value in ordered(BASIC, direction)))
                    assert [row[0] for row in result["rows"]] == wanted, (direction, result, wanted)
                report["runs"].append({"ansi": ansi, "responses": responses, "statements": statements})
            assert report["runs"][0]["responses"] == report["runs"][1]["responses"], "ANSI changed responses"
            if not args.skip_perf:
                spark.conf.set("spark.sql.ansi.enabled", "true")
                report["performance"] = benchmark(spark, statements)
            if args.output:
                args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
            print(f"PASS numeric question sorting probe in {time.perf_counter() - started:.0f} s", flush=True)
        finally:
            spark.stop()


if __name__ == "__main__":
    with localcontext() as ctx:
        ctx.prec = 100
        main()
