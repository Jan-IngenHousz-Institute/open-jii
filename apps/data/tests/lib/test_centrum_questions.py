"""Question keys from Spark match the reference rules, for edge cases, generated rows and long lists."""

from __future__ import annotations

import random

import pytest
from openjii.centrum.questions import sanitized_questions
from openjii.centrum.schemas import question_schema
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import ArrayType, IntegerType, StructField, StructType

pytestmark = pytest.mark.spark

_Question = dict[str, str | None]


def _reference_key(label: str | None) -> str:
    if not label:
        return "question_empty"
    sanitized = "".join(c if (c == "_" or (c.isascii() and c.isalnum())) else "_" for c in label.lower())
    while "__" in sanitized:
        sanitized = sanitized.replace("__", "_")
    sanitized = sanitized.strip("_")
    if not sanitized or sanitized[0].isdigit():
        sanitized = f"question_{sanitized}"
    return sanitized


def _reference_questions(questions_array: list[_Question | None] | None) -> list[dict[str, str | None]]:
    """The keying rules, written as plain Python."""
    if questions_array is None or len(questions_array) == 0:
        return []
    base_labels = [_reference_key(q.get("question_label")) if q else None for q in questions_array]
    label_total: dict[str, int] = {}
    for bl in base_labels:
        if bl is not None:
            label_total[bl] = label_total.get(bl, 0) + 1

    key_counts: dict[str, int] = {}
    result = []
    for q in questions_array:
        if not q:
            continue
        base = _reference_key(q.get("question_label"))
        if label_total.get(base, 0) <= 1:
            key = base
        else:
            text = q.get("question_text")
            text_part = _reference_key(text) if text else None
            candidate = base if not text_part or text_part == base else f"{base}__{text_part}"
            count = key_counts.get(candidate, 0) + 1
            key_counts[candidate] = count
            key = candidate if count == 1 else f"{candidate}_{count}"
        result.append({"question_label": key, "question_answer": q.get("question_answer")})
    return result


def _q(label: str | None, text: str | None = None, answer: str | None = "yes") -> _Question:
    return {"question_label": label, "question_text": text, "question_answer": answer}


_CASES = [
    [_q("Plot")],
    [_q("Plot no."), _q("Leaf Angle (°)"), _q("  spaced  out  ")],
    [_q(""), _q(None), _q("___"), _q("9 leaves"), _q("--")],
    [_q("Crème brûlée"), _q("Straße"), _q("İstanbul"), _q("\N{KELVIN SIGN}"), _q("🌱 sprout")],
    [_q("plot", "Plot number"), _q("Plot", "Plot name"), _q("PLOT", "")],
    [_q("plot"), _q("plot"), _q("plot", "plot"), _q("plot", None)],
    [_q("plot", "A"), _q("plot", "a"), _q("plot", "A!"), _q("plot", "b")],
    [None, _q("plot"), None, _q("plot")],
    [_q("a__b"), _q("a_b"), _q("a", "b"), _q("a", "b")],
    [None],
    [],
    [_q("Leaf") for _ in range(60)],
    [_q("Leaf", f"Leaf {i % 7}") for i in range(60)],
]

_ALPHABET = ["a", "B", "1", "_", " ", ".", "é", "ß", "İ", "🌱", "-", "Z", "0"]


def _random_case(rng: random.Random) -> list[_Question | None]:
    def text() -> str | None:
        roll = rng.random()
        if roll < 0.15:
            return None
        if roll < 0.25:
            return ""
        return "".join(rng.choice(_ALPHABET) for _ in range(rng.randint(1, 6)))

    pool = [text() for _ in range(rng.randint(1, 3))]
    return [
        None if rng.random() < 0.05 else _q(rng.choice(pool), rng.choice([*pool, text()]), text())
        for _ in range(rng.randint(1, 6))
    ]


def test_question_keys_match_the_reference_rules(spark: SparkSession) -> None:
    rng = random.Random(1937)
    cases = _CASES + [_random_case(rng) for _ in range(2_000)]
    schema = StructType(
        [StructField("n", IntegerType()), StructField("questions", ArrayType(question_schema))]
    )
    rows = spark.createDataFrame(list(enumerate(cases)), schema)

    keyed = rows.select("n", sanitized_questions(F.col("questions")).alias("keyed")).collect()

    got = {row["n"]: [item.asDict() for item in row["keyed"]] for row in keyed}
    expected = {n: _reference_questions(case) for n, case in enumerate(cases)}
    mismatched = {n: (cases[n], got[n], expected[n]) for n in expected if got[n] != expected[n]}
    assert mismatched == {}


def test_a_null_list_stays_null(spark: SparkSession) -> None:
    rows = spark.createDataFrame(
        [(None,)], StructType([StructField("questions", ArrayType(question_schema))])
    )

    [row] = rows.select(sanitized_questions(F.col("questions")).alias("keyed")).collect()

    assert row["keyed"] is None
