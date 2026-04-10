# Key Features

This page highlights the main capabilities of the openJII platform. For detailed guides and examples, follow the links to the Web Platform and Mobile App documentation.

### Web platform

- **Scalable data layer:** ingest, store and query large time-series and sensor datasets efficiently.
- **Secure authentication & access:** sign in with email (6-digit OTP code), ORCID or GitHub; control experiment visibility. On mobile, when offline, an offline banner with a wifi-off icon appears on the login screen and all authentication buttons are disabled until network connectivity is restored.
- **Experiment management:** create, edit and version experiments; add members, locations, metadata and tags. See the Web Platform [overview](../003-data-platform/002-web-platform/001-overview.md) and [create/edit experiment guide](../003-data-platform/002-web-platform/0013-create-add-experiment.md).
- **Measurement flow editor:** visual drag-and-drop editor (Instruction, Question, Measurement, Analysis) to define what field users should do.
- **Data exploration & analysis:** interactive dashboards, filters and export options for downstream analysis.
- **APIs & integrations:** ingestion via REST/MQTT and connectors for notebooks and external systems.

### Mobile app (Android)

- **Sensor support:** connect to supported sensors (MultispeQ) over Bluetooth and run measurements.
- **Redesigned measurement flow:** guided flows with auto-advance, smart skipping, and animated progress for rapid field data collection.
- **QR code scanning:** scan QR codes to populate answers in NumberQuestion and OpenEndedQuestion inputs, or to apply a MultipleChoiceQuestion option. Uses the device camera for faster data entry compared to manual typing. Requires camera permissions.
- **Question-only flows:** collect survey data and field observations without a sensor measurement.
- **Offline-first:** capture data offline with on-device gzip compression; sync when network is available. User sessions are maintained during temporary network drops. After login, all experiment data is prefetched and cached so measurements can run completely offline.
- **Comments & annotations:** add comments to measurements via swipe actions.
- **Bulk delete synced measurements:** remove all synced measurements from local storage to free up space on the mobile device.
- **Python macros:** run Python post-processing macros on-device via embedded Pyodide runtime.

See the Mobile App [overview](../003-data-platform/002-mobile-app.md) for device-specific details.

