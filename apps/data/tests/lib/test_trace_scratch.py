"""The smoke test's scratch-schema guardrails.

The smoke task is the only thing in this repo that issues ``DROP SCHEMA ...
CASCADE``, and it runs as the principal that holds CREATE/DROP over the whole
catalog. These tests are the standing proof that no input can aim that statement
at a schema holding data.
"""

from __future__ import annotations

import pytest
from openjii.trace import scratch


class TestNewScratchSchema:
    def test_is_prefixed_and_unique(self) -> None:
        first = scratch.new_scratch_schema("job-42")
        second = scratch.new_scratch_schema("job-42")
        assert first.startswith(scratch.SCRATCH_SCHEMA_PREFIX)
        assert first != second, "two concurrent runs must not share a schema"

    def test_generated_names_always_pass_the_drop_guard(self) -> None:
        for token in ("", "job-42", "RUN/../centrum", "'; DROP SCHEMA centrum; --", "x" * 200):
            assert scratch.assert_disposable(scratch.new_scratch_schema(token))

    def test_token_is_only_a_readability_aid(self) -> None:
        # Anything that could close an identifier is stripped, not escaped.
        name = scratch.new_scratch_schema('a.b`c"d e;f')
        assert set(name) <= set("abcdefghijklmnopqrstuvwxyz0123456789_")

    def test_prefix_cannot_collide_with_a_real_schema(self) -> None:
        assert not any(
            schema.startswith(scratch.SCRATCH_SCHEMA_PREFIX) for schema in scratch.PROTECTED_SCHEMAS
        )
        assert "centrum" in scratch.PROTECTED_SCHEMAS


class TestAssertDisposable:
    @pytest.mark.parametrize(
        "schema",
        [
            "centrum",
            "default",
            "information_schema",
            "data-legacy",
            "system",
            "",
            None,
            "CENTRUM",
            "centrum_v3_smoke",
            "open_jii_dev.centrum",
            "centrum; DROP SCHEMA other",
            "`centrum`",
            "zz_v3_smoke_",
            "zz_v3_smoke_short",
            "zz_v3_smoke_UPPER1234",
            "zz_v3_smoke_has.dot1234",
            "prefix_zz_v3_smoke_abcd1234",
        ],
    )
    def test_refuses_everything_it_did_not_generate(self, schema) -> None:
        with pytest.raises(ValueError):
            scratch.assert_disposable(schema)

    def test_accepts_a_generated_name(self) -> None:
        name = f"{scratch.SCRATCH_SCHEMA_PREFIX}abcdef0123456789"
        assert scratch.assert_disposable(name) == name


class TestAssertCatalog:
    def test_accepts_a_plain_identifier(self) -> None:
        assert scratch.assert_catalog("open_jii_dev") == "open_jii_dev"

    @pytest.mark.parametrize(
        "catalog", ["", None, "open jii", "open_jii_dev.centrum", "a`b", "x;y", "a" * 65]
    )
    def test_refuses_anything_else(self, catalog) -> None:
        with pytest.raises(ValueError):
            scratch.assert_catalog(catalog)
