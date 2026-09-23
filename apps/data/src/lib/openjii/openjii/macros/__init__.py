"""Shared building blocks for the macro-execution DLT pipeline.

Holds only ``openjii.macros.runtime``, which reads ``spark.conf`` eagerly and
must only be imported inside the running pipeline. It exists because
``openjii.centrum.runtime`` requires confs this pipeline does not set.

This is a separate deployment, not a separate domain. Macro execution calls the
backend sandbox over HTTP from a Spark task, and while it shared the centrum
pipeline those tasks held its slots for hours and ingestion stalled behind them.
The tables it publishes are centrum-schema gold either way: a compute boundary
does not get its own namespace.
"""
