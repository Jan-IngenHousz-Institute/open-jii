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
    takes its question's text as a suffix, or a position when the text adds nothing.
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

        def numbered(candidates: Column) -> Column:
            def key(item: Column, i: Column) -> Column:
                seen = F.size(
                    F.filter(F.slice(candidates, 1, i + 1), lambda c: c["candidate"] == item["candidate"])
                )
                label = F.when(~item["shared"] | (seen == 1), item["candidate"]).otherwise(
                    F.concat(item["candidate"], F.lit("_"), seen.cast("string"))
                )
                return F.struct(
                    label.alias("question_label"), item["q"]["question_answer"].alias("question_answer")
                )

            return F.transform(candidates, key)

        return _bound(F.transform(items, candidate), numbered)

    return _bound(with_bases, with_candidates)
