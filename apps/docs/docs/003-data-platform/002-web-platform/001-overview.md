import DocButton from '@site/src/components/DocButton';

# Overview

The openJII Web Platform (https://openjii.org/) provides a secure, scalable environment to manage experiments, collect sensor time-series, and run reproducible analyses.

### Key features

- **Scalable data layer:** Efficient ingestion, storage, and querying of large time-series and sensor datasets with partitioning and compression for performance.
- **Secure authentication & access control:** OneTimePassword (OTP) email login, ORCID and GitHub sign-in, plus [role-based access](./roles) and configurable visibility (Public/Private). See [Register](./0012-register.md) to create an account.
- **Experiment management:** Create, edit and version experiments; add members, locations, metadata and tags; set visibility and embargo periods — see [Create / Edit Experiment](./0013-create-add-experiment.md).
- **Visual measurement flows:** Drag-and-drop flow editor (Instruction, Question, Measurement, Analysis nodes).
- **Data exploration & visualization:** Interactive dashboards, plots, filtering, and export (CSV) for downstream analysis.
- **Analysis & reproducibility:** Run analysis macros, integrate notebooks (Databricks/Jupyter), and capture provenance so analyses can be reproduced.

See [features of mobile app](../002-mobile-app.md)


Excited?
<DocButton href="../../introduction/quick-start-guide" variant="primary"> Follow our Quick Start Guide to try it out</DocButton>