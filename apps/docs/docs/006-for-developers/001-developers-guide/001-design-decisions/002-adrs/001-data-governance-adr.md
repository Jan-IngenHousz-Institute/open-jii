# Data Governance Model

**Date:** 2025-03-05  
**Status:** Accepted

---

## Context

Managing sensor data via the OpenJII platform requires a structured approach to ensure consistency, security, and reproducibility across diverse field experiments. The governance framework leverages catalogs, schemas, and tables to organize data, enforce access controls, and optimize query performance. Key objectives include:

- **Reproducibility & Auditability:** Immutable raw data and comprehensive logging ensure that data processing is repeatable and traceable.
- **Data Isolation & Access Control:** Isolating experiment data prevents interference and supports role-based permissions.
- **Scalability & Maintainability:** A standardized structure facilitates adding or archiving experiments and simplifies schema management.
- **Consistency & Performance:** Uniform naming conventions and preprocessed data storage enhance clarity and reduce query times.
- **Restricted Collaboration:** Enables cross-catalog and cross-schema collaboration that is managed by well-defined access policies.

---

## Decision

Implement a data governance framework structured around Databricks Unity Catalog’s three-tier namespace (Catalog → Schema → Table), with the following elements:

- **Catalogs:**

  - **Decision:** Use a single catalog (e.g., `openjii_dev` or `growy_dev`) covering the entire high-level domain of OpenJII-managed experiments.
  - **Rationale:** This simplifies the enforcement of enterprise security policies since permissions cascade to underlying objects and minimizes fragmentation while still allowing additional catalogs if new domains emerge.

- **Schemas:**

  - **Decision:** Create separate schemas within the catalog for each experiment (e.g., `wageningen_2025_orchids`, `amsterdam_2021_tulips`).
  - **Rationale:** Logical separation prevents data mixing, avoids naming conflicts, and supports granular access control, as well as easier decommissioning or archiving of an experiment’s data.

- **Tables:**

  - **Decision:** Standardize table structures within each schema to include:
    1. **Raw Data Table (`raw_data`):** Ingests and preserves sensor readings in their original state.
    2. **Clean Data Table (`clean_data`):** Stores validated, preprocessed data ready for analysis.
    3. **Metadata Tables:** Such as `experiment_metadata`, `sensor_metadata`, and `plant_metadata` for additional context.
  - **Rationale:** Immutable raw data ensures reproducibility while clean tables and metadata enhance query performance and automate processing decisions.

- **Volumes:**

  - **Decision:** Use volumes for both raw and processed datasets.
  - **Rationale:** Volumes support scalable, persistent storage with efficient data throughput and cost management independent of catalog/schema organization.

- **Views:**

  - **Decision:** Create views to present aggregated or filtered data without duplication.
  - **Rationale:** Views abstract complex queries and improve performance while providing tailored perspectives for data analysis.

- **Data Access & Security:**

  - **Decision:** Enforce strict governance using role-based access control (RBAC), data retention policies, and audit logging.
  - **Rationale:** This minimizes risk by restricting access based on roles, balancing storage costs with legal requirements, and ensuring accountability through detailed logging.

---

## Consequences

**Benefits:**

- **Enhanced Reproducibility & Auditability:** Clear traceability with immutable raw data and logs.
- **Improved Security:** Dedicated schemas and strict RBAC ensure that users can only access relevant data.
- **Scalability & Maintainability:** The standardized structure supports smooth expansion and efficient schema management.
- **Optimized Performance:** Preprocessed tables and views reduce query latency and computational overhead.
- **Facilitated Collaboration:** Restricted cross-schema collaboration supports joint work while maintaining data isolation.

**Trade-offs:**

- **Single Catalog vs. Multiple Catalogs:** Centralizing data in one catalog simplifies security but may limit isolation if diverse data domains grow.
- **Granular Isolation vs. Management Effort:** While dedicated schemas improve clarity and control, they may increase administrative overhead requiring automation for effective management.
- **Immutable Raw Data vs. Increased Storage Costs:** Retaining all raw data supports reproducibility at the cost of higher storage use, necessitating efficient retention strategies.
- **Preprocessed Data vs. Data Freshness:** Data preprocessing enhances performance but can introduce latency between ingestion and availability.
- **Strict RBAC vs. Administrative Complexity:** Detailed access controls improve security, though they require regular reviews and management.

---

## Conclusion

The proposed data governance model establishes a robust, scalable, and secure framework for managing agricultural sensor data. By leveraging a single catalog with dedicated schemas for each experiment, standardized table structures, and comprehensive security policies, the design ensures data integrity, optimized performance, and reproducibility. Despite some trade-offs in administrative overhead and storage costs, the framework aligns with industry best practices and meets the strategic needs of managing agricultural sensor data in a dynamic research environment.
