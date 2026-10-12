"""Databricks spend per platform component, priced from Databricks' own billing tables.

The billing tables cover the whole account, so the spend is limited to the workspace the named
components bill in. Job runs are priced together, since a job cannot name its own id to the
heartbeat that reads it, and whatever else that workspace runs is `other`.
"""

from __future__ import annotations

USAGE_TABLE = "system.billing.usage"
LIST_PRICES_TABLE = "system.billing.list_prices"

COST_WINDOW_DAYS = 7
JOBS_COMPONENT = "jobs"
OTHER_COMPONENT = "other"


def cost_components(named: dict[str, dict[str, str]]) -> list[str]:
    """Every component the spend is split into, the named ones first."""
    return [*named, JOBS_COMPONENT, OTHER_COMPONENT]


def cost_by_component_sql(
    named: dict[str, dict[str, str]],
    usage: str = USAGE_TABLE,
    prices: str = LIST_PRICES_TABLE,
) -> str:
    """Spend at list price per component over the last seven complete UTC days.

    `named` gives each component the usage_metadata field and id Databricks bills it under,
    such as `{"centrum": {"dlt_pipeline_id": "..."}}`. Components with no spend are absent.
    """
    claims = "\n".join(
        f"WHEN u.usage_metadata.{field} = '{bill_id}' THEN '{component}'"
        for component, claim in named.items()
        for field, bill_id in claim.items()
    )

    return f"""
        WITH priced AS (
          SELECT u.workspace_id,
                 CASE {claims}
                      WHEN u.billing_origin_product = 'JOBS' THEN '{JOBS_COMPONENT}'
                      ELSE '{OTHER_COMPONENT}'
                 END AS component,
                 u.usage_quantity * p.pricing.effective_list.default AS usd
          FROM {usage} u
          JOIN {prices} p
            ON p.sku_name = u.sku_name AND p.cloud = u.cloud AND p.usage_unit = u.usage_unit
           AND u.usage_end_time >= p.price_start_time
           AND (p.price_end_time IS NULL OR u.usage_end_time < p.price_end_time)
          WHERE u.usage_date BETWEEN date_sub(current_date(), {COST_WINDOW_DAYS}) AND date_sub(current_date(), 1)
        )
        SELECT component, round(sum(usd), 2) AS usd
        FROM priced
        WHERE workspace_id IN (
          SELECT workspace_id FROM priced WHERE component NOT IN ('{JOBS_COMPONENT}', '{OTHER_COMPONENT}')
        )
        GROUP BY component
    """
