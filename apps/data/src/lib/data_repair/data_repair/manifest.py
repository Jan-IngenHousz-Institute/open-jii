"""Decorator-driven registry for inline data repairs. See README.md."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from pyspark.sql import functions as F

if TYPE_CHECKING:
    from pyspark.sql import Column, DataFrame


Severity = Literal["apply", "advisory"]


@dataclass(frozen=True)
class InlineRepair:
    name: str
    table: str
    issue: str
    description: str
    severity: Severity
    fn: Callable[..., DataFrame]
    predicate: Callable[[], Column] | None = None


_INLINE_REPAIRS: list[InlineRepair] = []


def inline_repair(
    *,
    table: str,
    issue: str,
    description: str,
    severity: Severity = "apply",
    predicate: Callable[[], Column] | None = None,
):
    """Register a DataFrame transform. If ``predicate`` is set, the framework
    pre-filters by it so the repair (and any UDFs it calls) only touches
    matching rows. ``severity="advisory"`` registers without applying."""

    def _decorate(fn: Callable[[DataFrame], DataFrame]) -> Callable[[DataFrame], DataFrame]:
        _INLINE_REPAIRS.append(
            InlineRepair(
                name=fn.__name__,
                table=table,
                issue=issue,
                description=description,
                severity=severity,
                fn=fn,
                predicate=predicate,
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
        if repair.predicate is not None:
            keep = F.coalesce(repair.predicate(), F.lit(False))  # NULL -> false
            df = repair.fn(df.filter(keep)).unionByName(df.filter(~keep), allowMissingColumns=True)
        else:
            df = repair.fn(df)
        print(f"[REPAIR] {repair.name} ({repair.issue}): applied")
    return df


def list_repairs() -> list[InlineRepair]:
    """Current registry snapshot."""
    return list(_INLINE_REPAIRS)
