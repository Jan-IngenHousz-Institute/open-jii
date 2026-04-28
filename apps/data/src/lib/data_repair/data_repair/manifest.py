"""
Repair registry and apply helpers.

Two registration mechanisms, picked based on the repair shape:

- @register_function_repair: forward-protection. The repair function takes a
  Spark DataFrame and returns one with the corruption inverted on matching rows.
  Applied inside the silver/gold table projection. No-op for rows whose predicate
  excludes them.

- @register_overlay_repair: retroactive correction. Declares that a sidecar
  Delta table named `<table>_repairs` holds corrected versions of specific rows,
  to be LEFT JOIN + COALESCE'd by a `<table>_corrected` view. Useful when the
  affected rows have already been emitted downstream and the projection is
  streaming (no replay).

Both are intentionally dumb registries, populated at import time by decorators.
Each entry carries `issue` + `description` so anyone reading the pipeline can
trace a row back to its incident.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable, List

if TYPE_CHECKING:
    from pyspark.sql import DataFrame


@dataclass(frozen=True)
class FunctionRepair:
    name: str
    table: str
    issue: str
    description: str
    fn: Callable[[DataFrame], DataFrame]


@dataclass(frozen=True)
class OverlayRepair:
    name: str
    table: str
    issue: str
    description: str
    overlay_table: str
    coalesce_fields: tuple[str, ...]


_FUNCTION_REPAIRS: List[FunctionRepair] = []
_OVERLAY_REPAIRS: List[OverlayRepair] = []


def register_function_repair(*, table: str, issue: str, description: str):
    """Decorator: register a Spark DataFrame transform as a forward-protection repair."""

    def _decorate(fn: Callable[[DataFrame], DataFrame]) -> Callable[[DataFrame], DataFrame]:
        _FUNCTION_REPAIRS.append(
            FunctionRepair(name=fn.__name__, table=table, issue=issue, description=description, fn=fn)
        )
        return fn

    return _decorate


def register_overlay_repair(
    *,
    table: str,
    issue: str,
    description: str,
    overlay_table: str,
    coalesce_fields: tuple[str, ...],
):
    """Decorator: declare that a sidecar Delta table provides retroactive corrections.

    The decorated function is a marker only (its body is not executed by the framework);
    the wiring lives in the silver/gold layer's view definition, which calls
    `apply_overlay_repairs(table)` to discover the overlays + fields.
    """

    def _decorate(fn: Callable[[], None]) -> Callable[[], None]:
        _OVERLAY_REPAIRS.append(
            OverlayRepair(
                name=fn.__name__,
                table=table,
                issue=issue,
                description=description,
                overlay_table=overlay_table,
                coalesce_fields=tuple(coalesce_fields),
            )
        )
        return fn

    return _decorate


def apply_function_repairs(df: DataFrame, table_name: str) -> DataFrame:
    """Walk the function-repair registry, apply matching repairs in registration order."""
    for repair in _FUNCTION_REPAIRS:
        if repair.table != table_name:
            continue
        print(f"[REPAIR] {repair.name} ({repair.issue})")
        df = repair.fn(df)
    return df


def apply_overlay_repairs(table_name: str) -> List[OverlayRepair]:
    """Return overlay-repair declarations for `table_name`. Caller owns the view DDL."""
    return [r for r in _OVERLAY_REPAIRS if r.table == table_name]


def list_repairs() -> tuple[List[FunctionRepair], List[OverlayRepair]]:
    """Snapshot of the current registry. Useful for tests + observability."""
    return list(_FUNCTION_REPAIRS), list(_OVERLAY_REPAIRS)
