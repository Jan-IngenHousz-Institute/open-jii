"""
Enrich Library

This library provides data enrichment utilities for ELT pipelines,
enabling integration with backend services to enrich measurement
data with additional metadata and other contextual information.
"""

__version__ = "0.1.0"

from .backend_client import BackendClient, BackendIntegrationError
from .user_metadata import add_user_data_column
from .question_metadata import add_question_columns, get_experiment_question_labels, add_annotation_columns

__all__ = [
    "BackendClient",
    "BackendIntegrationError",
    "add_user_data_column",
    "add_question_columns",
    "get_experiment_question_labels",
    "add_annotation_columns"
]