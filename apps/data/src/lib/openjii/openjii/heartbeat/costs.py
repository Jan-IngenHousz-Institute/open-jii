"""Databricks spend per platform component, priced from Databricks' own billing tables.

The billing tables cover the whole account, so the spend is limited to the workspace the named
components bill in. Job runs are priced together, since a job cannot name its own id to the
heartbeat that reads it, and whatever else that workspace runs is `other`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone

USAGE_TABLE = "system.billing.usage"
LIST_PRICES_TABLE = "system.billing.list_prices"

JOBS_COMPONENT = "jobs"
OTHER_COMPONENT = "other"


@dataclass(frozen=True)
class CostWindows:
    """The UTC days one export prices, with exclusive ends, as the cost publisher reads AWS.

    Each figure is stamped at its window's close: CloudWatch holds back a point stamped a day or
    more in the past for two days, and a window that closes at midnight lands in exactly one daily
    or weekly bucket however a dashboard aligns its periods.
    """

    today: date
    week_start: date
    week_end: date
    month_start: date
    next_month_start: date
    previous_month_start: date
    previous_month_to_date_end: date

    @property
    def yesterday(self) -> date:
        return self.today - timedelta(days=1)

    @property
    def day_closed_at(self) -> datetime:
        return datetime.combine(self.today, time(), tzinfo=timezone.utc)

    @property
    def week_closed_at(self) -> datetime:
        return datetime.combine(self.week_end, time(), tzinfo=timezone.utc)

    def projected(self, month_to_date: float) -> float:
        """The month at the pace of its complete days, which on the 1st is the month just ended."""
        elapsed = (self.today - self.month_start).days
        return month_to_date * (self.next_month_start - self.month_start).days / elapsed


def cost_windows(now: datetime) -> CostWindows:
    """Yesterday, the latest complete ISO week, and the month of yesterday against the one before."""
    today = now.astimezone(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    week_end = today - timedelta(days=today.weekday())
    month_start = yesterday.replace(day=1)
    previous_month_start = (month_start - timedelta(days=1)).replace(day=1)

    return CostWindows(
        today=today,
        week_start=week_end - timedelta(days=7),
        week_end=week_end,
        month_start=month_start,
        next_month_start=(month_start + timedelta(days=32)).replace(day=1),
        previous_month_start=previous_month_start,
        previous_month_to_date_end=min(previous_month_start + timedelta(days=yesterday.day), month_start),
    )


def cost_components(named: dict[str, dict[str, str]]) -> list[str]:
    """Every component the spend is split into, the named ones first."""
    return [*named, JOBS_COMPONENT, OTHER_COMPONENT]


def _in_window(start: date, end: date) -> str:
    return f"round(sum(CASE WHEN usage_date >= DATE'{start}' AND usage_date < DATE'{end}' THEN usd ELSE 0 END), 2)"


def cost_windows_sql(
    named: dict[str, dict[str, str]],
    windows: CostWindows,
    usage: str = USAGE_TABLE,
    prices: str = LIST_PRICES_TABLE,
) -> str:
    """Spend at list price per component in each of the windows.

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
          SELECT u.workspace_id, u.usage_date,
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
          WHERE u.usage_date >= DATE'{windows.previous_month_start}' AND u.usage_date < DATE'{windows.today}'
        )
        SELECT component,
               {_in_window(windows.yesterday, windows.today)} AS day_usd,
               {_in_window(windows.week_start, windows.week_end)} AS week_usd,
               {_in_window(windows.month_start, windows.today)} AS month_to_date_usd,
               {_in_window(windows.previous_month_start, windows.previous_month_to_date_end)} AS previous_month_to_date_usd,
               {_in_window(windows.previous_month_start, windows.month_start)} AS previous_month_usd
        FROM priced
        WHERE workspace_id IN (
          SELECT workspace_id FROM priced WHERE component NOT IN ('{JOBS_COMPONENT}', '{OTHER_COMPONENT}')
        )
        GROUP BY component
    """


def weekly_measurements_sql(table: str, windows: CostWindows) -> str:
    """Measurements taken in the latest complete ISO week, which its spend is divided over."""
    return f"""
        SELECT count(*) AS measurements
        FROM {table}
        WHERE timestamp >= TIMESTAMP'{windows.week_start}T00:00:00Z'
          AND timestamp < TIMESTAMP'{windows.week_end}T00:00:00Z'
    """
