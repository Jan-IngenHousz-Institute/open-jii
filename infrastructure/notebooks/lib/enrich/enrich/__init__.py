"""
Enrich Library

This library provides data enrichment utilities for ELT pipelines,
enabling integration with backend services to enrich measurement
data with additional metadata and other contextual information.
"""

__version__ = "0.1.0"

from .backend_client import BackendClient, BackendIntegrationError
from .user_metadata import add_user_data_column

__all__ = [
    "BackendClient",
    "BackendIntegrationError",
    "add_user_data_column"
]