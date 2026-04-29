"""xlsx export helpers.

Spark DataFrame → single-sheet xlsx file. All shape-fixing (complex-type
JSON serialization, per-cell truncation) runs as Spark transforms; only
the final write materializes the data on the driver via pyspark.pandas.

Most callers want :func:`write_xlsx` — the lower-level helpers are
exposed for tests and for callers that need to compose stages
themselves.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from pyspark.sql import DataFrame as SparkDataFrame

# Excel format hard limits, per the OOXML spec.
EXCEL_CELL_CHAR_LIMIT = 32_767
EXCEL_MAX_ROWS = 1_048_576  # 2^20, per sheet
EXCEL_SHEET_NAME_LIMIT = 31

# Sheet names cannot contain any of these characters (Excel rejects them
# at open time, openpyxl rejects them at write time).
_EXCEL_SHEET_DISALLOWED = r":\/?*[]"


class ExcelRowLimitError(ValueError):
    """Raised when a DataFrame exceeds Excel's per-sheet row limit.

    Carries the actual row count so callers can decide whether to
    truncate via ``df.limit()`` and retry, or fail the export.
    """

    def __init__(self, row_count: int, limit: int):
        super().__init__(
            f"DataFrame has {row_count:,} rows; exceeds Excel limit of {limit:,}."
        )
        self.row_count = row_count
        self.limit = limit


def sanitize_sheet_name(name: Optional[str]) -> str:
    """Return a valid Excel sheet name.

    Replaces disallowed chars (``: \\ / ? * [ ]``) with ``_``, truncates
    to 31 chars, and falls back to ``"data"`` if the input is empty or
    reduces to empty.
    """
    if not name:
        return "data"
    cleaned = name.translate(str.maketrans({c: "_" for c in _EXCEL_SHEET_DISALLOWED}))
    cleaned = cleaned[:EXCEL_SHEET_NAME_LIMIT]
    return cleaned or "data"


def truncate_string_columns(
    sdf: "SparkDataFrame", limit: int = EXCEL_CELL_CHAR_LIMIT
) -> "SparkDataFrame":
    """Truncate every StringType column to ``limit`` characters.

    Implemented as a Spark ``substring`` transform — runs distributed,
    no driver collect. Guards against ``openpyxl.IllegalCharacterError``,
    which fires on cells longer than the per-cell character cap.
    """
    from pyspark.sql.functions import col, substring
    from pyspark.sql.types import StringType

    for field in sdf.schema.fields:
        if isinstance(field.dataType, StringType):
            sdf = sdf.withColumn(field.name, substring(col(field.name), 1, limit))
    return sdf


def prepare_for_excel(sdf: "SparkDataFrame") -> "SparkDataFrame":
    """Apply Spark-side transforms required for a safe xlsx emission.

    - struct/array/map → JSON string, so each value lands in a single
      cell instead of being expanded across columns by openpyxl.
    - variant → string cast (variant already stores JSON internally).
    - all resulting StringType columns truncated via
      :func:`truncate_string_columns`.

    Pure Spark transformation — no action is triggered until the caller
    collects, counts, or writes.
    """
    from pyspark.sql.functions import col, to_json
    from pyspark.sql.types import ArrayType, MapType, StructType, VariantType

    for field in sdf.schema.fields:
        if isinstance(field.dataType, (StructType, ArrayType, MapType)):
            sdf = sdf.withColumn(field.name, to_json(col(field.name)))
        elif isinstance(field.dataType, VariantType):
            sdf = sdf.withColumn(field.name, col(field.name).cast("string"))

    return truncate_string_columns(sdf)


def write_xlsx(
    sdf: "SparkDataFrame",
    output_path: str,
    sheet_name: str,
    *,
    max_rows: int = EXCEL_MAX_ROWS,
) -> dict:
    """Write a Spark DataFrame to a single-sheet xlsx file.

    Steps:

    1. :func:`prepare_for_excel` — fix value shapes on the Spark side.
    2. Row-count check — raise :class:`ExcelRowLimitError` *before* any
       data is collected, so oversized exports fail fast and cheap.
    3. ``pandas_api().to_excel(...)`` — collect to the driver and emit
       the workbook through openpyxl.

    Step 3 materializes the entire DataFrame on the driver. Callers
    handling very large exports should pre-filter or split.

    Writes to ``output_path`` on the driver's local filesystem; moving
    the file to its final destination (e.g. ``dbutils.fs.cp`` into a
    Unity Catalog volume) is the caller's responsibility.

    Returns a report dict suitable for structured logs::

        {"row_count": int, "sheet_name": str, "output_path": str}
    """
    import pyspark.pandas as ps

    safe = prepare_for_excel(sdf)

    row_count = safe.count()
    if row_count > max_rows:
        raise ExcelRowLimitError(row_count, max_rows)

    # pyspark.pandas refuses to operate under ANSI SQL mode (Spark 4
    # default). Our usage — type-stable to_excel of an already-prepared
    # DataFrame — doesn't rely on the lax-arithmetic behavior the guard
    # warns about, so opt out for this call instead of forcing callers
    # to disable ANSI mode globally on the SparkSession.
    ps.set_option("compute.fail_on_ansi_mode", False)

    sheet = sanitize_sheet_name(sheet_name)
    safe.pandas_api().to_excel(
        output_path,
        sheet_name=sheet,
        index=False,
        engine="openpyxl",
    )

    return {
        "row_count": row_count,
        "sheet_name": sheet,
        "output_path": output_path,
    }
