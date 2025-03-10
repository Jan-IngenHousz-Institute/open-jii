# Data Ingestion Architecture

**Date:** 2025-03-05  
**Status:** Accepted

---

## Context

The OpenJII platform collects sensor data from agricultural IoT devices across multiple experiments, creating unique data processing challenges. This data must support both operational analytics for platform management and specialized scientific analysis for researchers. The ingestion architecture must handle streaming data from AWS Kinesis while supporting both real-time monitoring and batch analytical processing.

A key challenge is balancing centralized governance with experiment-specific flexibility. Sensor data should be processed once for common transformations while allowing researchers to apply specialized scientific transformations without affecting other experiments. Additionally, computing resources should be utilized efficiently, processing data for experiments only when necessary rather than on rigid schedules.

Given these requirements, we need an architecture that provides a unified ingestion pathway, clear data lineage, efficient resource utilization, and the flexibility to support diverse scientific research needs.

---

## Decision

We will implement a dual medallion architecture with event-driven pipeline orchestration that processes all data through a central schema while enabling experiment-specific processing in isolated schemas.

### Unified Ingestion Pipeline

All sensor data will initially flow through AWS Kinesis into the central schema's Bronze layer. This creates a single source of truth for all platform data, simplifying ingestion logic and ensuring complete data capture. The central Bronze layer will preserve original data attributes including experiment identifiers, timestamps, raw values, and metadata.

### Central Schema Processing

The central schema will implement the full medallion architecture:

The Bronze layer will capture raw sensor data directly from ingestion sources, preserving the original data in immutable form. This layer will include experiment identifiers that enable downstream routing.

The Silver layer will apply standardized cleansing, validation, and transformations that benefit all data consumers. This includes basic quality checks, unit conversions, timestamp normalization, and outlier detection. This layer creates a consistent, high-quality foundation for all downstream processing.

The Gold layer will generate platform-wide aggregations and metrics designed for operational analytics. This includes sensor performance statistics, experiment activity metrics, and cross-experiment comparisons needed by platform administrators.

### Experiment Schema Processing

Each experiment will have its own schema implementing a medallion architecture that begins with data from the central Silver tier:

The experiment Bronze layer will receive filtered data from the central Silver tier, creating an experiment-specific snapshot that serves as the foundation for reproducible scientific analysis. This approach ensures all experiments start with consistently processed data.

The Silver layer will apply experiment-specific transformations required by the research methodology. This might include specialized filtering, custom calculations, or protocol-specific processing that applies only to this experiment.

The Gold layer will generate specialized scientific analytics focused on the specific research questions being investigated. These analytics are optimized for scientific insight rather than platform operations.

### Event-Driven Pipeline Orchestration

Rather than running all experiment pipelines on fixed schedules, we will implement an event-driven orchestration approach using a central experiment registry table. This table will track experiment configurations and data freshness, enabling selective processing of only those experiments with new data.

When new data arrives in the central schema, the system will mark affected experiments as having "stale" data in the registry. The orchestration process will query this registry to identify and process only experiments with new data, updating their status upon successful completion.

To minimize code duplication across experiment pipelines, we'll implement templated pipeline code that accepts experiment identifiers as parameters. An extension mechanism will support experiment-specific customizations while maintaining a consistent core codebase.

### Data Processing Technologies

We will use AWS Kinesis for real-time data ingestion and Apache Spark for both stream and batch processing within Databricks. Data will be stored in Delta Lake format to benefit from ACID transactions, time travel capabilities, and efficient storage management.

The central schema and experiment schemas will both use the same underlying technologies but with different processing logic to support their specific purposes. This consistency simplifies platform management while enabling the specialized processing needed for each domain.

---

## Consequences

### Benefits

The dual medallion architecture with central Silver as the entry point for experiment schemas provides significant data quality benefits. All experiments inherit standardized cleansing and validation, creating a consistent foundation while preserving the flexibility for specialized scientific processing.

Scientific integrity is enhanced through the isolation of experiment processing. Each experiment has its own schema and processing pipeline, preventing cross-experiment contamination while maintaining clear lineage back to the original raw data.

Resource utilization is optimized through event-driven processing. By only running pipelines for experiments with new data, we avoid unnecessary computation and focus resources where they're needed. This creates a reactive data platform that scales efficiently with usage.

Maintenance is simplified through templated pipeline code. Updates to common processing logic can be made in a single location and propagated to all experiments, reducing the risk of divergence and inconsistency across the platform.

The architecture supports both operational and scientific analytics through the dual gold tier approach. Platform administrators receive cross-experiment insights for operational management, while scientists get specialized analytics tailored to their research questions.

### Trade-offs

The architecture introduces orchestration complexity that must be managed carefully. The event-driven approach requires robust tracking of data freshness and pipeline execution status, with proper handling of edge cases like failures and retries.

Storage requirements increase due to data duplication across schemas. While this is necessary for scientific integrity, it requires careful attention to storage optimization, retention policies, and lifecycle management.

Pipeline development becomes more sophisticated, requiring parameterized templates and extension mechanisms rather than simple, standalone pipelines. This demands stronger engineering practices but yields better maintainability at scale.

There is a slight increase in data latency as data flows through multiple processing stages. This trade-off favors data quality and scientific integrity over absolute real-time processing, which aligns with the priorities of agricultural research.

---

## Alternatives Considered

### Single Schema with Foreign Keys

We considered storing all experiment data in a single schema with foreign keys to identify experiment relationships. This approach would simplify implementation but would sacrifice scientific isolation and scalability. As experiments grow in number and complexity, query performance would degrade, and the risk of cross-experiment interference would increase. This approach would also make it difficult to apply experiment-specific transformations without complex conditional logic.

### Single Medallion Architecture

A simpler approach would use just one medallion architecture either centrally or per experiment. However, this would sacrifice either governance consistency (if done per experiment) or scientific flexibility (if done centrally). The dual medallion approach provides the best of both worlds, enabling centralized governance with experiment-specific customization.

### Schedule-Based Pipeline Execution

Traditional schedule-based pipeline execution would be simpler to implement but would waste resources processing experiments with no new data. For agricultural experiments with irregular data collection patterns, this inefficiency would become significant as the platform scales to hundreds of experiments.

### Fully Decoupled Pipelines

Completely separate pipelines for the central schema and each experiment would provide maximum isolation but would sacrifice the benefits of shared data quality standards and processing logic. The approach we've chosen strikes a balance by sharing the initial processing stages while enabling isolation for experiment-specific analysis.

---

## Conclusion

The dual medallion architecture with event-driven pipeline orchestration provides an elegant solution to the complex requirements of agricultural IoT research. By processing all data through a central schema first and then distributing it to experiment-specific schemas, we create a foundation of consistent data quality while preserving the scientific isolation needed for research integrity.

The central Silver tier serves as the ideal handoff point between platform processing and experiment-specific analysis, providing a cleansed, standardized dataset that serves as the starting point for scientific transformations. The dual Gold tier approach acknowledges the different analytical needs of platform operations and scientific research, allowing each to optimize for their specific requirements.

The event-driven orchestration pattern maximizes resource efficiency by processing data only when needed, creating a reactive data platform that scales effectively as the number of experiments grows. While this architecture introduces some complexity in orchestration and increased storage requirements, these trade-offs are justified by the significant benefits in scientific integrity, governance, and scalability.
