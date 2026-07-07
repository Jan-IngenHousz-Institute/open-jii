"""Shared pytest fixtures for openJII data tests."""

from __future__ import annotations

import sys
import types
from collections.abc import Iterator

import pytest


@pytest.fixture(scope="session")
def spark():
    """Session-scoped local Spark session.

    Marked via the ``spark`` fixture; tests that depend on it implicitly
    inherit the ``spark`` marker (use ``-m "not spark"`` to skip them).
    """
    from pyspark.sql import SparkSession

    session = (
        SparkSession.builder.master("local[2]")
        .appName("openjii-data-tests")
        .config("spark.sql.shuffle.partitions", "2")
        .config("spark.ui.showConsoleProgress", "false")
        .config("spark.driver.bindAddress", "127.0.0.1")
        .getOrCreate()
    )
    session.sparkContext.setLogLevel("ERROR")
    yield session
    session.stop()


@pytest.fixture
def fake_dlt(monkeypatch: pytest.MonkeyPatch) -> Iterator[types.ModuleType]:
    """Inject a no-op ``dlt`` module so pipeline files can be imported.

    Real ``dlt`` is only available inside Databricks. The fake exposes
    the decorators we use (``table``, ``view``, ``expect``, ``expect_or_drop``,
    ``on_event_hook``) as identity passthroughs so importing a pipeline file
    registers nothing but doesn't crash.
    """
    fake = types.ModuleType("dlt")

    def _passthrough_decorator(*args, **kwargs):
        # Support both ``@dlt.table`` and ``@dlt.table(...)`` forms.
        if len(args) == 1 and callable(args[0]) and not kwargs:
            return args[0]

        def _wrap(fn):
            return fn

        return _wrap

    for name in ("table", "view", "expect", "expect_or_drop", "expect_all", "on_event_hook"):
        setattr(fake, name, _passthrough_decorator)

    fake.read = lambda name: None  # type: ignore[attr-defined]
    fake.read_stream = lambda name: None  # type: ignore[attr-defined]

    monkeypatch.setitem(sys.modules, "dlt", fake)
    yield fake
