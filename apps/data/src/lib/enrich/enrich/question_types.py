"""Approved storage types for question-bearing gold writes, including queued old payloads."""

import pandas as pd
from pyspark.sql import functions as F
from pyspark.sql.types import ArrayType, StringType

from .backend_client import BackendClient
from .user_metadata import _is_uuid


def add_numeric_question_keys(df, environment: str, dbutils, *, has_questions=None):
    scope = f"node-webhook-secret-scope-{environment}"
    base_url = dbutils.secrets.get(scope=scope, key="webhook_base_url")
    api_key_id = dbutils.secrets.get(scope=scope, key="webhook_api_key_id")
    secret = dbutils.secrets.get(scope=scope, key="webhook_secret")

    @F.pandas_udf(returnType=ArrayType(StringType(), False), functionType=F.PandasUDFType.SCALAR)
    def keys(experiment_ids: pd.Series, has_questions: pd.Series) -> pd.Series:
        ids = list(
            dict.fromkeys(
                experiment_id
                for experiment_id, present in zip(experiment_ids, has_questions, strict=True)
                if present and isinstance(experiment_id, str) and _is_uuid(experiment_id)
            )
        )
        client = BackendClient(base_url, api_key_id, secret)
        approved = client.get_numeric_question_keys(ids)
        return experiment_ids.map(lambda experiment_id: approved.get(experiment_id, []))

    if has_questions is None:
        has_questions = F.coalesce(F.size("questions") > 0, F.lit(False))
    return df.withColumn(
        "_numeric_question_keys",
        keys(
            F.col("experiment_id"),
            has_questions,
        ),
    )
