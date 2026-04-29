"""xlsx export helpers.

Pure pandas-only functions so they can be unit-tested without a
Spark/Databricks runtime. The Databricks notebook
(apps/data/src/tasks/data_export_task.py) loads data and writes to the
Unity Catalog volume; these helpers just prepare the workbook.
"""

from __future__ import annotations

from typing import Optional

import pandas as pd

# Excel hard limit for a single cell value.
EXCEL_CELL_CHAR_LIMIT = 32767

# Excel sheet-name limit and disallowed characters.
EXCEL_SHEET_NAME_LIMIT = 31
_EXCEL_SHEET_DISALLOWED = r":\/?*[]"


def sanitize_sheet_name(name: Optional[str]) -> str:
    """Return a valid Excel sheet name (max 31 chars, no `: \\ / ? * [ ]`)."""
    if not name:
        return "data"
    cleaned = name.translate(str.maketrans({c: "_" for c in _EXCEL_SHEET_DISALLOWED}))
    cleaned = cleaned[:EXCEL_SHEET_NAME_LIMIT]
    return cleaned or "data"


def truncate_long_strings(pdf: pd.DataFrame, limit: int = EXCEL_CELL_CHAR_LIMIT) -> pd.DataFrame:
    """Truncate string cells longer than Excel's per-cell limit.

    Mutates and returns the same DataFrame. Non-string and missing values
    are left untouched.
    """
    for col in pdf.select_dtypes(include=["object"]).columns:
        pdf[col] = pdf[col].map(
            lambda v: v[:limit] if isinstance(v, str) and len(v) > limit else v
        )
    return pdf


def write_xlsx(pdf: pd.DataFrame, output_path: str, sheet_name: str) -> str:
    """Write a pandas DataFrame to a single-sheet xlsx file.

    Returns the output path for convenience. The caller is responsible for
    moving the file to its final destination (e.g. dbutils.fs.cp into a
    Unity Catalog volume).
    """
    sheet = sanitize_sheet_name(sheet_name)
    truncate_long_strings(pdf)
    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        pdf.to_excel(writer, sheet_name=sheet, index=False)
    return output_path
