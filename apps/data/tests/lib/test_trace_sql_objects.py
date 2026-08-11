"""The shipped DDL and fixtures.

The SQL itself can only be executed against a warehouse (VARIANT,
variant_explode and SQL UDFs do not exist in local PySpark), so what is checked
here is everything that can be: that the DDL renders, that it names the objects
the registration task claims to create, and that the fixtures it is validated
with are internally consistent.
"""

from __future__ import annotations

import pytest
from openjii.trace import fixtures, sql_objects
from openjii.trace.contract import V2_UNKNOWN_ARRAY_KEYS


class TestRendering:
    def test_every_statement_renders(self) -> None:
        statements = sql_objects.statements("open_jii_dev", "centrum")
        assert len(statements) == len(sql_objects.STATEMENT_FILES)
        for statement in statements:
            assert "${" not in statement, "unresolved placeholder"
            assert "open_jii_dev.centrum." in statement

    def test_each_file_is_a_single_statement(self) -> None:
        # The registration task calls spark.sql once per file, which only works
        # while each file holds exactly one statement. (Semicolons inside COMMENT
        # prose are fine, hence counting the verb rather than the separator.)
        for name in sql_objects.STATEMENT_FILES:
            body = sql_objects.read_sql(name).strip()
            assert body.count("CREATE OR REPLACE") == 1, name
            assert not body.endswith(";"), name

    def test_declared_objects_match_the_ddl(self) -> None:
        rendered = "\n".join(sql_objects.statements("open_jii_dev", "centrum"))
        for function in sql_objects.FUNCTIONS:
            assert f"FUNCTION open_jii_dev.centrum.{function}(" in rendered
        for view in sql_objects.VIEWS:
            assert f"VIEW open_jii_dev.centrum.{view}\n" in rendered

    def test_objects_are_replaceable(self) -> None:
        # Registration runs on every deploy, so nothing may be create-only.
        for statement in sql_objects.statements("open_jii_dev", "centrum"):
            first_code_line = next(
                line for line in statement.splitlines() if line.strip() and not line.strip().startswith("--")
            )
            assert first_code_line.startswith("CREATE OR REPLACE")

    def test_dependency_order(self) -> None:
        rendered = sql_objects.statements("open_jii_dev", "centrum")
        creation_index = {}
        for position, statement in enumerate(rendered):
            for name in (*sql_objects.FUNCTIONS, *sql_objects.VIEWS):
                if f".{name}(" in statement.split("\n")[0] or f".{name}\n" in statement:
                    creation_index.setdefault(name, position)
        for position, statement in enumerate(rendered):
            for name, created_at in creation_index.items():
                if created_at == position:
                    continue
                if f"open_jii_dev.centrum.{name}" in statement:
                    assert created_at < position, f"{name} is used before it is created"

    @pytest.mark.parametrize("filename", sql_objects.STATEMENT_FILES)
    def test_parentheses_and_quotes_balance(self, filename: str) -> None:
        # The DDL can only be executed against a warehouse, so the cheap
        # structural mistakes in a few hundred lines of hand-written SQL are worth
        # catching here rather than in a failed deploy.
        code = "\n".join(
            line.split("--")[0]
            for line in sql_objects.read_sql(filename).splitlines()
            if not line.strip().startswith("--")
        )
        assert code.count("'") % 2 == 0, f"{filename}: unbalanced string literal"
        depth = 0
        for character in code:
            depth += character == "("
            depth -= character == ")"
            assert depth >= 0, f"{filename}: closes a paren it never opened"
        assert depth == 0, f"{filename}: {depth} unclosed paren(s)"

    @pytest.mark.parametrize("identifier", ["", "cent rum", "centrum;DROP", "cent.rum"])
    def test_refuses_unsafe_identifiers(self, identifier: str) -> None:
        with pytest.raises(ValueError):
            sql_objects.render("SELECT 1 FROM ${catalog}.${schema}.t", identifier)


class TestSharedTimeRules:
    """The SQL has to encode the same rules as openjii.trace, not merely similar ones."""

    TRACE_SQL = ("02_trace_points.sql", "03_ambit_trace_v3.sql")

    ROUNDING_SQL = ("000_round_half_up.sql", "001_round_half_up_array.sql")
    ROUNDS = ("02_trace_points.sql", "03_ambit_trace_v3.sql", "04_ambyte_telemetry_v1.sql")

    @pytest.mark.parametrize("filename", ROUNDS)
    def test_rounding_goes_through_the_shared_primitive(self, filename: str) -> None:
        # Nothing may round on its own: Spark's round(x, d) is decimal half-up,
        # Python's is ties-to-even, and a bare floor(x·10^d + 0.5) is half-up only
        # for non-negative x (-24.605 would become -24.60).
        body = sql_objects.read_sql(filename).split("CREATE OR REPLACE")[1]
        code = "\n".join(
            line.split("--")[0] for line in body.splitlines() if not line.strip().startswith("--")
        )
        assert "round(" not in code, f"{filename} rounds without the shared primitive"
        assert "floor(" not in code, f"{filename} rounds without the shared primitive"
        assert "round_half_up" in code

    @pytest.mark.parametrize("filename", ROUNDING_SQL)
    def test_the_primitive_is_sign_aware(self, filename: str) -> None:
        code = sql_objects.read_sql(filename)
        # Half AWAY FROM ZERO: the negative branch negates before flooring.
        assert "WHEN v < 0 THEN -floor(-v * power(10, decimals) + 0.5) / power(10, decimals)" in code
        assert "ELSE floor(v * power(10, decimals) + 0.5) / power(10, decimals)" in code

    def test_the_two_rounding_copies_are_the_same_rule(self) -> None:
        # The array variant repeats the expression instead of calling the scalar
        # function from inside a lambda; the copies must not drift.
        def rule(filename: str) -> list[str]:
            return [
                line.strip()
                for line in sql_objects.read_sql(filename).splitlines()
                if "power(10, decimals)" in line or "v IS NULL" in line
            ]

        assert rule(self.ROUNDING_SQL[0]) == rule(self.ROUNDING_SQL[1])

    def test_explicit_t_is_branched_on_presence_not_per_element(self) -> None:
        # A per-element coalesce would refill a missing explicit entry from
        # (t0, dt) -- inventing a time the payload never stated, and disagreeing
        # with series_offsets().
        code = sql_objects.read_sql("02_trace_points.sql")
        assert "WHEN try_variant_get(s.series_def, '$.t', 'array<string>') IS NOT NULL" in code
        assert "coalesce(\n            try_element_at(" not in code

    def test_ambient_windows_are_reconstructed_per_segment(self) -> None:
        code = sql_objects.read_sql("03_ambit_trace_v3.sql")
        assert "ambient_centres" in code
        assert "ambient_resolved" in code
        # 8 pulses per mean, centred on the window, on that segment's clock.
        assert "least(8, seg.pulses - w * 8)" in code

    def test_zero_duration_is_a_known_duration(self) -> None:
        # The estimator clamp applies whenever the duration is known, including a
        # measured zero; only an absent duration leaves the cadence model alone.
        code = sql_objects.read_sql("03_ambit_trace_v3.sql")
        assert "d.duration_ms IS NOT NULL" in code
        assert "d.duration_ms > 0" not in code

    def test_unknown_arrays_are_preserved_over_the_shared_range(self) -> None:
        code = sql_objects.read_sql("03_ambit_trace_v3.sql")
        for key in V2_UNKNOWN_ARRAY_KEYS:
            assert f"'{key}', CASE WHEN e.{key} IS NOT NULL" in code, key
            assert f"'$.data.{key}', 'array<bigint>'" in code, key
        # arr8 is consumed as leaf_temp's device offsets, not carried as a series.
        assert "'arr8', CASE" not in code

    def test_health_is_gated_on_the_status_recognizer(self) -> None:
        # §11.2: an explicit BME280 snapshot samples no health at all, whatever
        # health-shaped keys its data/metadata happens to carry.
        code = sql_objects.read_sql("04_ambyte_telemetry_v1.sql")
        assert code.count("CASE WHEN a.is_v2_status THEN coalesce(") == 37
        assert "s -> b.is_v2_status AND s.sensor_id IS NOT NULL" in code
        # No health leaf may be read without passing the gate.
        for line in code.splitlines():
            if "try_variant_get(a.obj, '$.metadata." in line:
                assert "ambit" in line or "is_v2_status" in code


class TestMeasurementObjectExpr:
    def test_matches_the_function_it_mirrors(self) -> None:
        # Gold inlines the rule instead of depending on the registered function;
        # the two must stay the same rule.
        function_body = sql_objects.read_sql("01_measurement_object.sql")
        for fragment in ("'$[0]'", "'$[1]'", "IS NULL", "IS NOT NULL"):
            assert fragment in sql_objects.MEASUREMENT_OBJECT_EXPR
            assert fragment in function_body

    def test_reads_the_silver_sample_column(self) -> None:
        assert "parse_json(sample)" in sql_objects.MEASUREMENT_OBJECT_EXPR


class TestFixtures:
    def test_every_file_loads(self) -> None:
        loaded = fixtures.load_all()
        assert set(loaded) == {fixtures.TRACES, fixtures.TELEMETRY, fixtures.DEVICES}
        for group in loaded.values():
            assert group

    def test_names_are_unique_and_ids_are_unique(self) -> None:
        names, ids = [], []
        for group in fixtures.load_all().values():
            names.extend(f["name"] for f in group)
            ids.extend(f["row"]["id"] for f in group)
        assert len(names) == len(set(names))
        assert len(ids) == len(set(ids)), "the smoke test joins on row id"

    def test_every_group_has_a_negative_case(self) -> None:
        # Each normalizer must be shown returning NULL for a row it does not own.
        for name, group in fixtures.load_all().items():
            assert len(fixtures.normalizable(group)) < len(group), name

    def test_rows_carry_a_json_sample(self) -> None:
        rows = fixtures.rows(fixtures.load(fixtures.TRACES))
        assert all(row["sample_json"].startswith("[") for row in rows)

    def test_inventory_expectations(self) -> None:
        devices = fixtures.load(fixtures.DEVICES)
        # Three sensors, one of which announces two different calibrations.
        assert len(fixtures.expected_latest_sensors(devices)) == 3
        assert len(fixtures.expected_inventory_tuples(devices)) == 4

    def test_by_name_raises_on_a_typo(self) -> None:
        with pytest.raises(KeyError):
            fixtures.by_name(fixtures.load(fixtures.TRACES), "nope")
