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
    keyed: list[tuple[_Question, str, bool]] = []
    for q in questions_array:
        if not q:
            continue
        base = _reference_key(q.get("question_label"))
        if label_total.get(base, 0) <= 1:
            keyed.append((q, base, False))
            continue
        text = q.get("question_text")
        text_part = _reference_key(text) if text else None
        candidate = base if not text_part or text_part == base else f"{base}__{text_part}"
        key_counts[candidate] = key_counts.get(candidate, 0) + 1
        keyed.append((q, candidate, key_counts[candidate] > 1))

    used = {candidate for _, candidate, repeat in keyed if not repeat}
    result = []
    for q, candidate, repeat in keyed:
        key = candidate
        if repeat:
            n = 2
            while f"{candidate}_{n}" in used:
                n += 1
            key = f"{candidate}_{n}"
            used.add(key)
        result.append({"question_label": key, "question_answer": q.get("question_answer")})
    return result


def _unchecked_questions(questions_array: list[_Question | None] | None) -> list[dict[str, str | None]]:
    """The rules before a position was checked against the other keys, kept to show that every
    measurement they keyed without a clash keys the same way now."""
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
    [_q("Leaf"), _q("Leaf"), _q("Leaf 2")],
    [_q("Leaf 2"), _q("Leaf"), _q("Leaf")],
    [_q("Leaf"), _q("Leaf"), _q("Leaf"), _q("Leaf 2"), _q("Leaf 3")],
    [_q("Leaf"), _q("Leaf"), _q("Leaf 2"), _q("Leaf 2")],
    [_q("Leaf", "height"), _q("Leaf", "height"), _q("Leaf", "height 2")],
    [_q("Leaf") for _ in range(30)] + [_q(f"Leaf {i}") for i in range(2, 32)],
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
    labels = [*pool, *(f"{label} {rng.randint(2, 3)}" for label in pool if label)]
    return [
        None if rng.random() < 0.05 else _q(rng.choice(labels), rng.choice([*pool, text()]), text())
        for _ in range(rng.randint(1, 6))
    ]


def _cases() -> list[list[_Question | None]]:
    rng = random.Random(1937)
    return _CASES + [_random_case(rng) for _ in range(2_000)]


def _keyed(
    spark: SparkSession, cases: list[list[_Question | None]]
) -> dict[int, list[dict[str, str | None]]]:
    schema = StructType(
        [StructField("n", IntegerType()), StructField("questions", ArrayType(question_schema))]
    )
    rows = spark.createDataFrame(list(enumerate(cases)), schema)
    keyed = rows.select("n", sanitized_questions(F.col("questions")).alias("keyed")).collect()
    return {row["n"]: [item.asDict() for item in row["keyed"]] for row in keyed}


def test_question_keys_match_the_reference_rules(spark: SparkSession) -> None:
    cases = _cases()

    got = _keyed(spark, cases)

    expected = {n: _reference_questions(case) for n, case in enumerate(cases)}
    mismatched = {n: (cases[n], got[n], expected[n]) for n in expected if got[n] != expected[n]}
    assert mismatched == {}


def test_every_question_in_a_measurement_gets_its_own_key(spark: SparkSession) -> None:
    got = _keyed(spark, _cases())

    keys = {n: [item["question_label"] for item in items] for n, items in got.items()}
    shared = {n: labels for n, labels in keys.items() if len(labels) != len(set(labels))}
    assert shared == {}


def test_keys_that_were_already_distinct_stay_as_they_were(spark: SparkSession) -> None:
    cases = _cases()

    got = _keyed(spark, cases)

    before = {n: _unchecked_questions(case) for n, case in enumerate(cases)}
    distinct = [n for n, items in before.items() if len({i["question_label"] for i in items}) == len(items)]
    changed = {n: (cases[n], got[n], before[n]) for n in distinct if got[n] != before[n]}
    assert changed == {}


@pytest.mark.parametrize(
    ("labels", "keys"),
    [
        (["Leaf", "Leaf"], ["leaf", "leaf_2"]),
        (["Leaf", "Leaf", "Leaf 2"], ["leaf", "leaf_3", "leaf_2"]),
    ],
)
def test_a_repeat_takes_the_next_position_no_other_question_holds(
    spark: SparkSession, labels: list[str], keys: list[str]
) -> None:
    got = _keyed(spark, [[_q(label) for label in labels]])

    assert [item["question_label"] for item in got[0]] == keys


def test_a_null_list_stays_null(spark: SparkSession) -> None:
    rows = spark.createDataFrame(
        [(None,)], StructType([StructField("questions", ArrayType(question_schema))])
    )

    [row] = rows.select(sanitized_questions(F.col("questions")).alias("keyed")).collect()

    assert row["keyed"] is None
