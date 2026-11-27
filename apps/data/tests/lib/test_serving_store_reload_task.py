"""Which store tables the reload task reloads for the experiment and table it is given."""

from __future__ import annotations

import importlib.util
import types
from pathlib import Path

import pytest
from openjii.serving_store.reload import Reloaded, StoreReload
from openjii.serving_store.tables import StoreTable
from openjii.serving_store.writer import StoreWriter, Written

_TASK_PATH = Path(__file__).parents[2] / "src/tasks/serving_store_reload_task.py"

# Each table the task reloads, with the experiment it names, in order.
_Reloads = list[tuple[str, str | None]]


class _Widgets:
    def __init__(self, values: dict[str, str]) -> None:
        self.values = values

    def text(self, name: str, default: str) -> None:
        self.values.setdefault(name, default)

    def get(self, name: str) -> str:
        return self.values[name]


class _Secrets:
    def get(self, scope: str, key: str) -> str:
        return f"{key}-value"


@pytest.fixture
def reloads(monkeypatch: pytest.MonkeyPatch) -> _Reloads:
    reloaded: _Reloads = []

    def reload(
        self: StoreReload, table: StoreTable, experiment_id: str | None = None, allow_removal: bool = False
    ) -> Reloaded:
        reloaded.append((table.name, experiment_id))
        return Reloaded(table.name, 7, Written(), Written(), source={}, store={}, newer={}, older={})

    monkeypatch.setattr(StoreWriter, "check", lambda self: None)
    monkeypatch.setattr(StoreReload, "reload", reload)
    return reloaded


def _run(experiment: str, table: str) -> None:
    widgets = _Widgets(
        {
            "CATALOG_NAME": "open_jii_dev",
            "CENTRAL_SCHEMA": "centrum",
            "ENVIRONMENT": "dev",
            "EXPERIMENT_ID": experiment,
            "TABLE": table,
        }
    )
    spec = importlib.util.spec_from_file_location("serving_store_reload_task", _TASK_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    module.dbutils = types.SimpleNamespace(widgets=widgets, secrets=_Secrets())  # type: ignore[attr-defined]
    module.spark = None  # type: ignore[attr-defined]
    spec.loader.exec_module(module)


def test_one_experiment_with_every_table_skips_device_events(reloads: _Reloads) -> None:
    _run("e1", "all")

    assert reloads == [("measurements", "e1"), ("macro_results", "e1"), ("uploads", "e1")]


def test_device_events_for_one_experiment_fail_before_any_reload(reloads: _Reloads) -> None:
    with pytest.raises(ValueError, match="TABLE device_events holds no experiment's rows"):
        _run("e1", "device_events")

    assert reloads == []


def test_every_experiment_with_every_table_leaves_device_events_out(reloads: _Reloads) -> None:
    _run("all", "all")

    assert reloads == [("measurements", None), ("macro_results", None), ("uploads", None)]


def test_device_events_reload_when_named_for_every_experiment(reloads: _Reloads) -> None:
    _run("all", "device_events")

    assert reloads == [("device_events", None)]
