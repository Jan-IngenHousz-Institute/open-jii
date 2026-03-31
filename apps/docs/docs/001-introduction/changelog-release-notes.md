# Changelog & Release Notes

The openJII platform uses per-app semantic versioning (e.g. `web-v1.21.0`, `backend-v1.17.0`, `mobile-v1.11.0`). Releases are published on [GitHub](https://github.com/Jan-IngenHousz-Institute/open-jii/releases). The milestones below group features by product phase.

If you have suggestions, feel free to do a [feature request](../data-platform/report-issue).

---

## Production Launch (17 March 2026)

The platform went live with updated mobile and web apps.

### New Features

- **Protocol & Macro Page Redesign** — Protocol and macro pages now follow the same layout patterns as experiment pages, with inline-editable titles/descriptions and sidebar metadata (#1115)
- **Protocol-Macro Many-to-Many** — Protocols and macros can now be linked freely in any combination (#1090)
- **IoT Package** — Introduced a dedicated IoT package for platform-agnostic sensor communication with pluggable transport and driver layers (#1112)
- **Mobile: Measurement Flow Redesign** — Completely redesigned measurement flow with animated progress bar, auto-advance, smart skipping, and integrated experiment selection (#1117)
- **Mobile: Local Export** — Export and save measurements locally on your device as JSON (#1093, #1094)
- **Mobile: Gzip Measurement Storage** — Measurements are compressed before storing on-device, reducing storage usage (#1142)
- **Mobile: Comments & Swiping** — Add comments to measurements via bottom-sheet modal; swipe actions for upload, comment, and delete (#1062)
- **Mobile: Python Macros** — Run Python macros on-device via embedded Pyodide runtime (#1062)
- **Project Transfers** — Import experiments, protocols, and measurement data from external platforms like PhotosynQ (#1060)
- **Platform User Invitations** — Invite collaborators by email; pending invitations auto-accepted on first sign-in (#1069)
- **Async Data Exports** — Export data in multiple formats (CSV, NDJSON, JSON, Parquet) via background jobs (#1047)

### Improvements

- **Production Monitoring with Grafana** — Amazon Managed Grafana dashboards live in production for infrastructure monitoring (#1032, #1118, #1120, #1121)
- **Better Auth Migration** — Migrated from NextAuth.js to Better Auth — unified authentication across web and mobile via backend API, email login now uses 6-digit OTP codes (#933)
- **Updated Member Permissions** — Visualizations, data uploads, experiment settings, and flows restricted to admin role (#1020)
- **Data Layer Overhaul** — Centralized `centrum` schema replacing per-experiment schemas, VARIANT columns for flexible JSON storage (#1004)
- **MQTT Data Compression** — Sensor payloads compressed with gzip + base64 before transmission (#1081)
- **Table Identity Refactor** — `identifier` + `tableType` discriminator decoupling table identity from display names (#1092)
- **SWC Backend Build** — Backend now uses the SWC compiler with bundle resolution (#1150)
- **Server Time Synchronization** — Timestamps now use server time for consistency across clients (#1126)
- **Pino Logging** — Backend logging overhauled with structured JSON logging via Pino (#936)
- **Monitoring Module** — ECS, IoT, Kinesis, and DORA metrics dashboards (#916, #1015)
- **Secrets Rotation** — Automated credential rotation module (#986)
- **Sort Order & Preferred Badges** — Protocols and macros can be assigned sort order with "Preferred" badge (#991, #1156)
- **Cookie Banner Consent** — GDPR-compliant cookie consent banner (#922)
- **Mobile Crash Reporting** — PostHog integration for crash diagnostics (#1096)
- **CI/CD: Node 24 Compatibility** — GitHub Actions upgraded to Node 24-compatible versions (#1143)
- **CI/CD: Tag-Based Mobile Versioning** — Mobile app version derived from release tags (#1089)

### Bug Fixes

- Fixed mobile measurement flow UX issues and comment modal bottom sheet (#1144)
- Fixed clickable area on web navigation tabs (#1140)
- Fixed Databricks provider issue (#1138)
- Fixed corrupted header image on mobile (#1134)
- Fixed false high-connection Grafana alert (#1113)
- Resolved mobile lint warnings and formatting issues (#1116)
- Various CI/CD fixes for mobile release triggers, submit workflows, and EAS build versioning (#1114, #1119, #1133, #1135, #1137, #1139)

**Full Changelog**: https://github.com/Jan-IngenHousz-Institute/open-jii/compare/release/03032026...release/17032026

---

## Public Beta — v0.2 (8 December 2025)

### Mobile app

- Back button in measurement process
- Offline measurements
- Turn off MultispeQ

### Web platform

- Notification when added to Experiment
- Visualizations

---

## Beta Launch — v0.1 (November 2025)

First beta release. Experiment flows (questions, instructions, measurements, macros), macro support, mobile flow integration.

---

## Roadmap

Current milestones (Q2 2026):

1. **Platform Maturity & User Experience** — UX polish, user profiles, account pages, infrastructure hardening, remove beta branding (target: May 2026)
2. **Protocol & Macro Development Notebook** — Jupyter-notebook-style environment for protocol/macro development (target: April 2026)
3. **Standardised IoT & Sensor Communication** — Ambyte/Ambit onboarding, bidirectional mobile-device communication for calibration (target: May 2026)
4. **Data Exploration, BI & Analysis Dashboards** — Self-service tools for researchers, Apache Superset evaluation (target: June 2026)
5. **Visual Geo-Localisation for Field Validation** — Camera-based location validation for field experiments
