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

    for name in ("table", "view", "expect", "expect_or_drop", "expect_all", "on_event_hook", "append_flow"):
        setattr(fake, name, _passthrough_decorator)

    fake.read = lambda name: None  # type: ignore[attr-defined]
    fake.read_stream = lambda name: None  # type: ignore[attr-defined]
    # Silver declares its table at module level, so an import-based test of it
    # fails on the fixture rather than on the file it is testing.
    fake.create_streaming_table = lambda **kwargs: None  # type: ignore[attr-defined]

    monkeypatch.setitem(sys.modules, "dlt", fake)
    yield fake


@pytest.fixture
def fake_dp(monkeypatch: pytest.MonkeyPatch) -> Iterator[types.ModuleType]:
    """Inject a ``pyspark.pipelines`` that records the sinks and flows a notebook defines.

    ``sinks`` maps a sink's name to its batch function; ``flows`` maps a flow's name to its
    target and its function.
    """
    import pyspark

    fake = types.ModuleType("pyspark.pipelines")
    sinks: dict = {}
    flows: dict = {}

    def foreach_batch_sink(name):
        def register(fn):
            sinks[name] = fn
            return fn

        return register

    def append_flow(target, name):
        def register(fn):
            flows[name] = (target, fn)
            return fn

        return register

    fake.sinks = sinks  # type: ignore[attr-defined]
    fake.flows = flows  # type: ignore[attr-defined]
    fake.foreach_batch_sink = foreach_batch_sink  # type: ignore[attr-defined]
    fake.append_flow = append_flow  # type: ignore[attr-defined]

    monkeypatch.setitem(sys.modules, "pyspark.pipelines", fake)
    monkeypatch.setattr(pyspark, "pipelines", fake, raising=False)
    yield fake
