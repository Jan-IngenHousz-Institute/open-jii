"""Unit tests for exports.xlsx — pure-Python helpers only.

Covers ``sanitize_sheet_name`` and ``ExcelRowLimitError``. Always runs;
pyspark is not required.

Spark-backed behavior is covered in ``test_xlsx_integration.py``.
"""

from __future__ import annotations

from exports.xlsx import (
    EXCEL_MAX_ROWS,
    EXCEL_SHEET_NAME_LIMIT,
    ExcelRowLimitError,
    sanitize_sheet_name,
)


class TestSanitizeSheetName:
    def test_keeps_simple_name(self):
        assert sanitize_sheet_name("raw_data") == "raw_data"

    def test_falls_back_when_empty(self):
        assert sanitize_sheet_name("") == "data"
        assert sanitize_sheet_name(None) == "data"

    def test_truncates_to_31_chars(self):
        long = "a" * 50
        result = sanitize_sheet_name(long)
        assert len(result) == EXCEL_SHEET_NAME_LIMIT
        assert result == "a" * EXCEL_SHEET_NAME_LIMIT

    def test_replaces_disallowed_characters(self):
        assert sanitize_sheet_name("a:b/c\\d?e*f[g]h") == "a_b_c_d_e_f_g_h"


class TestExcelRowLimitError:
    def test_carries_counts(self):
        err = ExcelRowLimitError(2_000_000, EXCEL_MAX_ROWS)
        assert err.row_count == 2_000_000
        assert err.limit == EXCEL_MAX_ROWS
        assert "2,000,000" in str(err)
        assert "1,048,576" in str(err)

    def test_is_a_value_error(self):
        assert issubclass(ExcelRowLimitError, ValueError)
