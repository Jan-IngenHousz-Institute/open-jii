"""OpenJII data analysis helpers for Databricks.

Helpers for reading and transforming data in Databricks pipelines and
notebooks: catalog-aware table reading, set-data explosion, and gzip+base64
sample decompression.
"""

from .compression import decompress_sample, decompress_sample_value
from .helpers import (
    explode_set_data,
    get_catalog_name,
    get_table_metadata,
    load_experiment_table,
    read_table,
)
from .json_scrub import scrub_non_finite_json, scrub_non_finite_json_value

__all__ = [
    "decompress_sample",
    "decompress_sample_value",
    "explode_set_data",
    "get_catalog_name",
    "get_table_metadata",
    "load_experiment_table",
    "read_table",
    "scrub_non_finite_json",
    "scrub_non_finite_json_value",
]
__version__ = "0.1.0"
