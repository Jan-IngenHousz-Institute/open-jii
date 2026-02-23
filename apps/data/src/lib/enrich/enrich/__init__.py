"""
Enrich Library

This library provides data enrichment utilities for ELT pipelines,
enabling integration with backend services to enrich measurement
data with additional metadata and other contextual information.
"""

__version__ = "0.1.0"

from .backend_client import BackendClient, BackendIntegrationError
from .user_metadata import add_user_column
from .question_metadata import add_question_columns, get_experiment_question_labels
from .annotations_metadata import add_annotation_column
from .macro_execution import make_execute_macro_udf

__all__ = [
    "BackendClient",
    "BackendIntegrationError",
    "add_user_column",
    "add_question_columns",
    "get_experiment_question_labels",
    "add_annotation_column",
    "make_execute_macro_udf",
]