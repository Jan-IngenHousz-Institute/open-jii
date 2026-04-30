"""Decorator-driven registry for inline data repairs. See README.md."""
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
    """Register a DataFrame transform that fires when ``apply_inline_repairs``
    runs against ``table``. ``severity="advisory"`` registers without applying."""

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
    """Apply every repair registered for ``table_name`` in registration order."""
    for repair in _INLINE_REPAIRS:
        if repair.table != table_name:
            continue
        if repair.severity == "advisory":
            print(f"[REPAIR][advisory] {repair.name} ({repair.issue}): registered, not applied")
            continue
        df = repair.fn(df)
        print(f"[REPAIR] {repair.name} ({repair.issue}): applied")
    return df


def list_repairs() -> List[InlineRepair]:
    """Current registry snapshot."""
    return list(_INLINE_REPAIRS)
