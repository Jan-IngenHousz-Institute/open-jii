# Data Governance Model

**Date:** 2025-03-05  
**Status:** Accepted

---

## Context

The OpenJII platform manages agricultural sensor data across diverse field experiments, requiring a governance framework that ensures consistency, security, and scientific reproducibility. Researchers conduct experiments with various sensor-plant combinations, collecting data that must be both isolated for scientific integrity and accessible for collaboration.

Agricultural research demands rigorous data isolation between experiments while still enabling platform-wide analytics. Scientists need assurance that their experimental data remains unaffected by other experiments, yet administrators require cross-experiment insights to manage the platform effectively.

The governance framework must balance these competing requirements while addressing key objectives: ensuring experiment reproducibility, maintaining data isolation, supporting platform scalability, enforcing consistency, optimizing performance, and enabling appropriate collaboration.

---

## Decision

We will implement a data governance framework leveraging Databricks Unity Catalog's three-tier namespace (Catalog → Schema → Table) with a dual-schema approach that separates central platform data from experiment-specific processing.

### Catalog Structure

We will use a single catalog (e.g., `openjii_dev`) covering the entire domain of OpenJII-managed experiments. This approach simplifies security policy enforcement by allowing permissions to cascade to underlying objects while minimizing fragmentation. The unified catalog provides a clean namespace that encompasses all platform data while still allowing for future expansion if distinct data domains emerge.

### Schema Architecture

Our schema architecture will consist of two key components:

1. A central schema (`centrum`) will serve as the primary ingestion point and single source of truth for all sensor data. This schema will implement the complete medallion architecture (Bronze-Silver-Gold) to provide standardized processing and platform-wide analytics.

2. Experiment-specific schemas (e.g., `wageningen_2025_orchids`, `amsterdam_2021_tulips`) will isolate data for individual scientific experiments. Each experiment schema will inherit data from the central silver tier and implement its own medallion layers for experiment-specific processing.

This dual-schema approach creates a clear separation between platform-wide operations and scientific experiments while maintaining data lineage throughout the system.

### Medallion Architecture Implementation

Both the central and experiment schemas will implement medallion architecture layers:

In the central schema, the Bronze layer captures raw sensor data from all sources, preserving original timestamps, values, and experiment identifiers. The Silver layer applies standardized cleansing, transformations, and quality checks that benefit all downstream consumers. The Gold layer creates platform-wide aggregations and metrics for operational analytics.

In experiment schemas, the Bronze layer receives filtered data from the central Silver tier, creating an experiment-specific snapshot for reproducibility. The Silver layer applies specialized scientific transformations required by the research methodology. The Gold layer generates experiment-specific analytics focused on scientific research questions.

This dual medallion approach creates two specialized gold tiers - one for platform operations and one for scientific research - enabling both operational excellence and scientific rigor within the same architecture.

### Data Flow Between Schemas

The central Silver tier serves as the critical handoff point between platform-wide processing and experiment-specific analysis. By using the central Silver tier as the starting point for experiment schemas, we provide a consistent quality foundation across all experiments while enabling specialized scientific transformations. This approach optimizes resource utilization by centralizing common transformations while maintaining the flexibility needed for scientific research.

### Access Control and Security

Security will be maintained through role-based access controls that align with the natural boundaries of our architecture. Platform administrators will have access to the central schema, while researchers will primarily access their experiment-specific schemas. Cross-experiment collaboration will be enabled through carefully managed access policies that preserve data isolation requirements.

---

## Consequences

### Benefits

The dual-schema, dual-medallion approach significantly enhances scientific reproducibility by creating clear boundaries between experiments. Each experiment has its own isolated processing pipeline that can be exactly reproduced, with immutable snapshots preserved at each stage of processing.

Security is improved through the natural isolation boundaries of separate schemas. Role-based access control becomes more intuitive, as permissions can be aligned with organizational roles: platform administrators for the central schema and research teams for their specific experiment schemas.

The standardized structure supports scalable expansion as new experiments are added. The central schema continues to serve as the foundation, while new experiment schemas can be provisioned through automation with consistent structure and processing logic.

The dual gold tier approach recognizes the fundamentally different analytical needs of platform operations versus scientific research. Platform administrators gain operational insights across all sensors and experiments, while scientists receive tailored analytics specific to their research questions without compromise.

Scientific integrity is preserved through the physical isolation of experiment data processing. Changes in one experiment's processing logic cannot affect other experiments, and each experiment maintains clear lineage back to the original raw data.

### Trade-offs

While the architecture provides strong isolation, it comes with increased complexity in pipeline orchestration. Managing potentially hundreds of similar experiment pipelines requires sophisticated orchestration techniques using a central registry and event-driven processing.

The dual medallion approach increases storage requirements due to data duplication across schemas. This trade-off is necessary for scientific integrity but requires careful attention to storage optimization and data lifecycle management.

Maintaining consistent processing logic across experiment schemas requires a templated approach to pipeline development and centralized management of common transformation code. Without proper governance, experiment pipelines could diverge over time.

The data handoff from central silver to experiment bronze creates a slight delay in data availability compared to a single-schema approach. This trade-off is acceptable given the priority of scientific integrity over real-time processing in agricultural research.

---

## Conclusion

The proposed data governance model establishes a sophisticated framework that prioritizes scientific integrity while enabling efficient platform operations. By implementing a dual-schema architecture with central silver tier as the foundation for experiment-specific processing, we create clear boundaries between experiments while maintaining consistent data quality standards.

The dual medallion architecture with separate gold tiers for platform operations and scientific research acknowledges the distinct analytical needs of these domains and prevents compromise in either area. This approach aligns perfectly with the requirements of agricultural IoT research, where scientific reproducibility and data isolation are paramount.

Despite the increased complexity and storage requirements, the architecture's benefits in scientific integrity, security, and scalability make it the optimal choice for the OpenJII platform. The framework establishes a foundation that will support diverse agricultural experiments while maintaining the rigor required for scientific research.
