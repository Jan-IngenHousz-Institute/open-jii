"""Tests for openjii.helpers.get_catalog_name (post build-time-injection removal)."""

from __future__ import annotations

import pytest
from openjii.helpers import get_catalog_name


class TestGetCatalogName:
    def test_reads_from_spark_conf(self, spark, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("OPENJII_CATALOG", raising=False)
        spark.conf.set("CATALOG_NAME", "open_jii_dev")
        try:
            assert get_catalog_name() == "open_jii_dev"
        finally:
            spark.conf.unset("CATALOG_NAME")

    def test_falls_back_to_env_var(self, spark, monkeypatch: pytest.MonkeyPatch) -> None:
        spark.conf.unset("CATALOG_NAME")
        monkeypatch.setenv("OPENJII_CATALOG", "from_env")
        assert get_catalog_name() == "from_env"

    def test_spark_conf_wins_over_env(self, spark, monkeypatch: pytest.MonkeyPatch) -> None:
        spark.conf.set("CATALOG_NAME", "from_conf")
        monkeypatch.setenv("OPENJII_CATALOG", "from_env")
        try:
            assert get_catalog_name() == "from_conf"
        finally:
            spark.conf.unset("CATALOG_NAME")

    def test_raises_when_unset(self, spark, monkeypatch: pytest.MonkeyPatch) -> None:
        spark.conf.unset("CATALOG_NAME")
        monkeypatch.delenv("OPENJII_CATALOG", raising=False)
        with pytest.raises(RuntimeError, match="Catalog not configured"):
            get_catalog_name()
