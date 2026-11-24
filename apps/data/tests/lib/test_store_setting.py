"""The settings of the data tests' store, which only ``pnpm test`` gives them."""

from __future__ import annotations

import pytest

from tests.conftest import store_setting


def test_an_unset_store_setting_says_to_run_the_tests_through_pnpm_test(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CLICKHOUSE_TEST_PORT", raising=False)

    with pytest.raises(
        RuntimeError, match="CLICKHOUSE_TEST_PORT is unset; run the data tests through pnpm test"
    ):
        store_setting("CLICKHOUSE_TEST_PORT")


def test_a_set_store_setting_is_its_value(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CLICKHOUSE_TEST_PORT", "8125")

    assert store_setting("CLICKHOUSE_TEST_PORT") == "8125"
