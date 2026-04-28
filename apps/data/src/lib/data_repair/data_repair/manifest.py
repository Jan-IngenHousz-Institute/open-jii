"""
Repair registry and apply helper.

A repair is a Spark DataFrame transform that inverts a known data corruption
on matching rows. Repairs register themselves at import time via the
``@inline_repair`` decorator and are applied in registration order inside
the silver/gold table projection via ``apply_inline_repairs``.

The registry is intentionally a dumb list, populated at import time by
decorators (same pattern as pytest fixtures or Flask routes). Each entry
carries ``issue`` + ``description`` so anyone reading the pipeline can
trace a row back to its incident.

Severity mirrors DLT's expectation ergonomics (``apply``/``advisory``); see
the README.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable, List, Literal

if TYPE_CHECKING:
    from pyspark.sql import DataFrame


Severity = Literal["apply", "advisory"]


@dataclass(frozen=True)
class InlineRepair:
    name: str
    table: str
    issue: str
    description: str
    severity: Severity
    fn: Callable[[DataFrame], DataFrame]


_INLINE_REPAIRS: List[InlineRepair] = []


def inline_repair(
    *,
    table: str,
    issue: str,
    description: str,
    severity: Severity = "apply",
):
    """Decorator: register a Spark DataFrame transform as a repair.

    The function is invoked once per pipeline run inside the target table's
    projection via ``apply_inline_repairs(df, table_name)``. Predicates inside
    the function body must exclude already-corrected rows so re-application
    is a no-op. If the inverse is not self-idempotent, the pipeline must
    guarantee single application some other way (full-refreshing the target
    table once after deploy, then relying on streaming append-only semantics).

    severity:
      - ``"apply"`` (default): the repair runs.
      - ``"advisory"``: the repair is registered and logged but skipped at
        ``apply_inline_repairs`` time. Use to land a new repair file and
        observe in pipeline logs before flipping it on.
    """

    def _decorate(fn: Callable[[DataFrame], DataFrame]) -> Callable[[DataFrame], DataFrame]:
        _INLINE_REPAIRS.append(
            InlineRepair(
                name=fn.__name__,
                table=table,
                issue=issue,
                description=description,
                severity=severity,
                fn=fn,
            )
        )
        return fn

    return _decorate


def apply_inline_repairs(df: DataFrame, table_name: str) -> DataFrame:
    """Walk the registry; apply matching repairs in registration order.

    Logs a row-count delta per repair so it's visible in DLT / Spark driver
    logs how much each repair touched.
    """
    for repair in _INLINE_REPAIRS:
        if repair.table != table_name:
            continue
        if repair.severity == "advisory":
            print(f"[REPAIR][advisory] {repair.name} ({repair.issue}): registered, not applied")
            continue
        before = df.count()
        df = repair.fn(df)
        after = df.count()
        print(f"[REPAIR] {repair.name} ({repair.issue}): rows {before} -> {after}")
    return df


def list_repairs() -> List[InlineRepair]:
    """Snapshot of the current registry (all severities). Useful for tests + observability."""
    return list(_INLINE_REPAIRS)
