"""
Enrich Library

This library provides data enrichment utilities for ELT pipelines,
enabling integration with backend services to enrich measurement
data with additional metadata and other contextual information.
"""

__version__ = "0.1.0"

from .backend_client import BackendClient, BackendIntegrationError
from .macro_execution import make_execute_macro_udf
from .question_metadata import add_question_columns, get_experiment_question_labels
from .transfer_metadata import execute_transfers

__all__ = [
    "BackendClient",
    "BackendIntegrationError",
    "add_question_columns",
    "execute_transfers",
    "get_experiment_question_labels",
    "make_execute_macro_udf",
]
