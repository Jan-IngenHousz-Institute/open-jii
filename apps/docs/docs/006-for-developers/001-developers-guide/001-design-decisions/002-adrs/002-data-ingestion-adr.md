# Data Ingestion Architecture

**Date:** 2025-03-05  
**Status:** Accepted

---

## Context

Sensor data from the OpenJII platform must be ingested, processed, and analyzed to support both real-time and batch processing. The system requirements include:

- **Real-Time and Batch Processing:** Sensor data is ingested in real time via AWS Kinesis and processed in batch mode with Apache Spark.
- **Dual Medallion Approach:** A dual medallion model (Bronze, Silver, Gold) ensures data quality and traceability by processing data in a centralized raw layer and further refining data per experiment.
  - **Central Schema:** Provides a holistic view of IoT, plant, and sensor data.
  - **Experiment-Specific Schemas:** Tailored pipelines route experiment-related records from the central raw layer into dedicated schemas for customized processing.
- **Metadata-Driven Routing:** A metadata-driven ingestion process dynamically routes records from the central raw layer to experiment-specific schemas via a dedicated transformation pipeline.
- **Scalability and Governance:** The architecture supports scalable ingestion, maintains a single source of truth, and enforces governance with role-based access controls and clear data lineage.

---

## Decision

Implement a data engineering architecture based on a dual medallion framework with both central and experiment-specific schemas. The key components include:

- **Unified Ingestion Pipeline:**  
  All sensor data is initially stored in a central raw layer (Bronze) via AWS Kinesis, serving as the single source of truth.

- **Central Schema Processing:**

  - **Bronze:** Captures raw sensor data.
  - **Silver:** Cleans, transforms, and applies quality checks.
  - **Gold:** Aggregates refined data for analytics and BI.

- **Experiment-Specific Processing:**  
  A metadata-driven process identifies experiment-specific records and routes them to dedicated experiment schemas with their own medallion layers:

  - **Bronze:** Receives the raw data for the experiment.
  - **Silver:** Processes and validates data according to experiment requirements.
  - **Gold:** Curates data to support specific research questions.

- **Data Processing Technologies:**

  - **Streaming and Batch:** Real-time ingestion via AWS Kinesis coupled with batch processing using Apache Spark.
  - **Data Formats:** Standard formats (e.g., Delta Lake, Parquet) ensure data consistency and efficient querying.

- **Data Lineage and Governance:**  
  Robust data lineage tracking and role-based access controls are maintained to ensure data integrity and compliance.

---

## Consequences

**Benefits:**

- **Data Quality & Traceability:**  
  Enhances data validation and provides a clear, auditable data lineage.

- **Flexibility & Scalability:**  
  Balances centralized data governance with the flexibility needed for experiment-specific customizations.

- **Resilience:**  
  Supports continuous data flows and detailed analytics through the integration of streaming and batch processing.

**Trade-offs:**

- **Increased Complexity:**  
  The dual medallion architecture and dynamic metadata-driven routing add complexity, requiring robust orchestration and metadata management.

- **Higher Storage Costs:**  
  Data duplication across multiple schemas increases storage requirements, which is necessary for maintaining data integrity.

- **Potential Latency:**  
  Metadata-driven routing may introduce delays. Fine-tuning batch sizes and processing intervals is essential to balance real-time performance with processing needs.

- **Security Overhead:**  
  Implementing detailed role-based access controls and regular audits increases administrative overhead but is essential for compliance and data protection.

---

## Alternatives Considered

- **Single Medallion Architecture:**  
  Simplifies design but lacks the flexibility required for experiment-specific customizations.

- **Fully Decoupled Pipelines:**  
  While offering completely separate pipelines for central and experiment-specific processing, this approach sacrifices shared data quality checks and a unified data source.

- **Batch-Only Processing:**  
  Reduces system complexity but fails to meet the real-time processing needs inherent to sensor data.

---

## Conclusion

The chosen architecture leverages a dual medallion model to balance centralized data governance with flexible, experiment-specific processing. This approach addresses both real-time streaming and batch processing needs, ensuring data quality, traceability, and scalability. Despite the trade-offs in complexity and storage costs, the design provides a robust and resilient solution for agricultural sensor data ingestion and analysis.
