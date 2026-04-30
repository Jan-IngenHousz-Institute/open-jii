"""Decorator-driven registry for inline data repairs. See README.md."""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable, List, Literal, Optional

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
    fn: Callable[..., "DataFrame"]
    # Cheap row-level filter (macro_id, version flag, etc.). Called at apply
    # time to produce a Column<Boolean>.
    predicate: Optional[Callable[[], "Column"]] = None


_INLINE_REPAIRS: List[InlineRepair] = []


def inline_repair(
    *,
    table: str,
    issue: str,
    description: str,
    severity: Severity = "apply",
    predicate: Optional[Callable[[], "Column"]] = None,
):
    """Register a DataFrame transform that fires when ``apply_inline_repairs``
    runs against ``table``.

    The decorated function receives the DataFrame plus a ``gate`` keyword
    argument: a Column<Boolean> derived from ``predicate`` (or always-True if
    no predicate). The repair AND's its own conditions (content signature,
    schema-shape checks) into ``gate`` before applying the inverse.

    severity="advisory" registers without applying.
    """

    def _decorate(fn: Callable[..., "DataFrame"]) -> Callable[..., "DataFrame"]:
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


def apply_inline_repairs(df: "DataFrame", table_name: str) -> "DataFrame":
    """Apply every repair registered for ``table_name`` in registration order."""
    for repair in _INLINE_REPAIRS:
        if repair.table != table_name:
            continue
        if repair.severity == "advisory":
            print(f"[REPAIR][advisory] {repair.name} ({repair.issue}): registered, not applied")
            continue
        gate = repair.predicate() if repair.predicate is not None else F.lit(True)
        df = repair.fn(df, gate=gate)
        print(f"[REPAIR] {repair.name} ({repair.issue}): applied")
    return df


def list_repairs() -> List[InlineRepair]:
    """Current registry snapshot."""
    return list(_INLINE_REPAIRS)
