"""A measurement's questions as keys and answers, written in Spark so no row passes through Python."""

from collections.abc import Callable

from pyspark.sql import Column
from pyspark.sql import functions as F


def _key(label: Column) -> Column:
    # Lowercase ASCII letters, digits and single underscores, so the key is safe as a Spark
    # identifier and as a JSON or VARIANT key wherever it is rendered.
    cleaned = F.regexp_replace(
        F.regexp_replace(F.regexp_replace(F.lower(label), "[^a-z0-9_]", "_"), "_+", "_"), "^_|_$", ""
    )
    keyed = F.when(
        (cleaned == "") | cleaned.rlike("^[0-9]"), F.concat(F.lit("question_"), cleaned)
    ).otherwise(cleaned)
    return F.when(label.isNull() | (label == ""), F.lit("question_empty")).otherwise(keyed)


def _bound(value: Column, body: Callable[[Column], Column]) -> Column:
    # A Column used twice is evaluated twice, and inside a lambda once per element; a lambda
    # variable is evaluated once.
    return F.element_at(F.transform(F.array(value), body), 1)


def sanitized_questions(questions: Column) -> Column:
    """Each question's label as a key, with its answer.

    A key shared within one measurement would make the map built from these fail, so a shared key
    takes its question's text as a suffix, or else the next position no other key holds.
    """
    present = F.filter(questions, lambda q: q.isNotNull())
    with_bases = F.transform(
        present, lambda q: F.struct(q.alias("q"), _key(q["question_label"]).alias("base"))
    )

    def with_candidates(items: Column) -> Column:
        def candidate(item: Column) -> Column:
            base = item["base"]
            shared = F.size(F.filter(items, lambda other: other["base"] == base)) > 1
            text = item["q"]["question_text"]
            text_key = F.when(text.isNotNull() & (text != ""), _key(text))
            with_text = F.when(text_key.isNull() | (text_key == base), base).otherwise(
                F.concat(base, F.lit("__"), text_key)
            )
            return F.struct(
                item["q"].alias("q"),
                shared.alias("shared"),
                F.when(shared, with_text).otherwise(base).alias("candidate"),
            )

        def counted(candidates: Column) -> Column:
            def count(item: Column, i: Column) -> Column:
                seen = F.size(
                    F.filter(F.slice(candidates, 1, i + 1), lambda c: c["candidate"] == item["candidate"])
                )
                return F.struct(
                    item["q"].alias("q"),
                    item["candidate"].alias("candidate"),
                    (item["shared"] & (seen > 1)).alias("repeat"),
                    seen.alias("seen"),
                )

            return _bound(F.transform(candidates, count), _numbered)

        return _bound(F.transform(items, candidate), counted)

    return _bound(with_bases, with_candidates)


def _numbered(items: Column) -> Column:
    # A repeat takes the next position whose key no unnumbered question holds, so "Leaf", "Leaf" and
    # "Leaf 2" key as leaf, leaf_3 and leaf_2. Two numbered keys never meet: a position has no
    # underscore, so a numbered key splits back into exactly one candidate and one position.
    def with_taken(taken: Column) -> Column:
        def key(item: Column) -> Column:
            candidate = item["candidate"]

            def numbered_key(n: Column) -> Column:
                return F.concat(candidate, F.lit("_"), n.cast("string"))

            free = F.filter(
                F.sequence(F.lit(2), item["seen"] + F.size(taken)),
                lambda n: ~F.array_contains(taken, numbered_key(n)),
            )
            # get rather than element_at, which raises on the index 0 a question that is not a repeat
            # would ask for if an engine ever evaluated both branches.
            label = F.when(item["repeat"], numbered_key(F.get(free, item["seen"] - 2))).otherwise(candidate)
            return F.struct(
                label.alias("question_label"), item["q"]["question_answer"].alias("question_answer")
            )

        return F.transform(items, key)

    unnumbered = F.filter(items, lambda item: ~item["repeat"])
    return _bound(F.transform(unnumbered, lambda item: item["candidate"]), with_taken)
