"""Enrich measurement DataFrames with user-uploaded custom metadata."""

from pyspark.sql import functions as F

COLUMN_MATCH_PREFIX = "column:"
MATCHABLE_MEASUREMENT_COLUMNS = ("device_id",)

_META_RECORDS = "_meta_records"
_QUESTIONS_DATA = "questions_data"

_ORDERED_METADATA_SQL = """
    transform(
        array_sort(
            collect_list(named_struct(
                'created_at', created_at,
                'metadata_id', metadata_id,
                'json', to_json(metadata)
            ))
        ),
        item -> parse_json(item.json)
    )
"""

# Used inside an aggregate lambda bound as (acc, x), where x is the later blob.
_MERGE_MAPS_SQL = """
    map_concat(
        map_filter(
            cast(acc AS MAP<STRING, VARIANT>),
            (k, v) -> NOT array_contains(
                map_keys(cast(x AS MAP<STRING, VARIANT>)),
                k
            )
        ),
        cast(x AS MAP<STRING, VARIANT>)
    )
"""


def _group_metadata(metadata_df):
    """Collapse metadata oldest-first; later blobs take precedence when merged."""
    return metadata_df.groupBy("experiment_id").agg(F.expr(_ORDERED_METADATA_SQL).alias(_META_RECORDS))


def _match_value_sql(columns):
    """Return SQL for the measurement value selected by a metadata blob.

    Existing blobs store a question key in ``experimentQuestionId``. A value
    prefixed with ``column:`` selects an allowlisted top-level measurement
    column instead. Unsupported prefixed values deliberately resolve to NULL.
    """
    key = "variant_get(meta, '$.experimentQuestionId', 'STRING')"
    column_cases = [
        f"WHEN {key} = '{COLUMN_MATCH_PREFIX}{column}' THEN CAST(`{column}` AS STRING)"
        for column in MATCHABLE_MEASUREMENT_COLUMNS
        if column in columns
    ]
    question_value = (
        f"variant_get({_QUESTIONS_DATA}, concat('$.', {key}), 'STRING')"
        if _QUESTIONS_DATA in columns
        else "CAST(NULL AS STRING)"
    )
    return "\n".join(
        [
            "CASE",
            *column_cases,
            f"WHEN {key} LIKE '{COLUMN_MATCH_PREFIX}%' THEN CAST(NULL AS STRING)",
            f"ELSE {question_value}",
            "END",
        ]
    )


def _merge_sql(columns):
    """Merge ordered blobs, with each later blob replacing repeated keys."""
    match_value = _match_value_sql(columns)
    return f"""
        aggregate(
            transform(
                {_META_RECORDS},
                meta -> parse_json(to_json(map_filter(
                    cast(
                        try_element_at(
                            filter(
                                cast(variant_get(meta, '$.rows', 'VARIANT') as ARRAY<VARIANT>),
                                r -> variant_get(
                                         r,
                                         concat('$.', variant_get(meta, '$.identifierColumnId', 'STRING')),
                                         'STRING'
                                     ) = {match_value}
                            ),
                            1
                        ) AS MAP<STRING, VARIANT>
                    ),
                    (k, v) -> k != '_id'
                               AND k != variant_get(meta, '$.identifierColumnId', 'STRING')
                )))
            ),
            cast(null as variant),
            (acc, x) -> CASE
                WHEN acc IS NULL THEN x
                WHEN x IS NULL THEN acc
                ELSE parse_json(to_json({_MERGE_MAPS_SQL}))
            END
        )
    """


def add_custom_metadata_column(df, metadata_df):
    """Add a ``custom_metadata`` VARIANT column to a measurement DataFrame."""
    has_match_value = _QUESTIONS_DATA in df.columns or any(
        column in df.columns for column in MATCHABLE_MEASUREMENT_COLUMNS
    )
    if not has_match_value:
        return df.withColumn("custom_metadata", F.lit(None).cast("variant"))

    try:
        enriched = df.join(_group_metadata(metadata_df), "experiment_id", "left")
        return enriched.withColumn(
            "custom_metadata",
            F.when(
                F.col(_META_RECORDS).isNotNull(),
                F.expr(_merge_sql(df.columns)),
            ),
        ).drop(_META_RECORDS)
    except Exception as error:
        print(f"Warning: Could not enrich with experiment metadata: {error!s}")
        return df.withColumn("custom_metadata", F.lit(None).cast("variant"))
