# Platform Overview

import DocButton from '@site/src/components/DocButton';

The openJII platform helps researchers collect, manage and analyse large-scale photosynthesis and sensor datasets. It combines a web-based management and analysis environment with a mobile app for field measurements.

## Platform

- **openJII Web platform:** register, create and manage experiments, design measurement flows, explore and analyse collected data.  
[Learn more →](./web-platform/overview)
- **openJII Mobile app (Android):** perform measurements in the field with MultispeQ and compatible sensors; supports offline capture and sync. [Learn more →](./002-mobile-app.md)

The mobile app works seamlessly with the MultispeQ sensor. Additional sensors and integrations are planned.

## Highlights

- **Scalable data layer:** Centralized `centrum` schema with medallion architecture (Bronze–Silver–Gold) for efficient ingestion, storage, and querying of large time-series and sensor datasets
- **Secure authentication:** Email login via 6-digit OTP code, ORCID and GitHub sign-in
- **User invitations:** Invite collaborators by email — pending invitations are automatically accepted when the invitee creates an account
- **Protocol-macro compatibility:** Many-to-many linking between protocols and macros
- **Visual measurement flows:** Drag-and-drop flow editor (Instruction, Question, Measurement, Analysis nodes)
- **Data exploration & visualization:** Interactive dashboards, plots, filtering, and export in multiple formats (CSV, NDJSON, JSON, Parquet) for downstream analysis
- **Data export:** Asynchronous export system — select your format, initiate the export, and download when ready
- **Project transfers:** Import experiments, protocols, and measurement data from external platforms

Excited to try it?

<DocButton href="../introduction/quick-start-guide" variant="primary"> Follow our Quick Start Guide </DocButton>