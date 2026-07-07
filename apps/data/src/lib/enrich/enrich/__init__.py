"""
Enrich Library

This library provides data enrichment utilities for ELT pipelines,
enabling integration with backend services to enrich measurement
data with additional metadata and other contextual information.
"""

__version__ = "0.1.0"

from .annotations_metadata import add_annotation_column
from .backend_client import BackendClient, BackendIntegrationError
from .custom_metadata import add_custom_metadata_column
from .device_metadata import add_device_registry
from .macro_execution import make_execute_macro_udf
from .question_metadata import add_question_columns, get_experiment_question_labels
from .transfer_metadata import execute_transfers
from .user_metadata import add_user_column

__all__ = [
    "BackendClient",
    "BackendIntegrationError",
    "add_annotation_column",
    "add_custom_metadata_column",
    "add_device_registry",
    "add_question_columns",
    "add_user_column",
    "execute_transfers",
    "get_experiment_question_labels",
    "make_execute_macro_udf",
]
