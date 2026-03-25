# System Architecture & Data Pipeline

## Data Schema

### Raw Measurement Data

Raw measurement data captured from the mobile app includes the following fields:

- **timestamp**: The normalized UTC timestamp (ISO 8601 format with 'Z' suffix, e.g., "2026-03-16T13:00:18.022Z"). This is the source of truth for temporal ordering.
- **timezone**: The IANA timezone name (e.g., "Europe/Amsterdam") captured from the mobile app. This field is nullable and may be `None` for legacy data collected before timezone support was added. Together with `timestamp`, these two fields are the source of truth—all local-time representations are derived from them.

The `timezone` field flows through the entire data pipeline alongside the measurement data, enabling downstream systems to derive local time representations.

## Data Processing & Enrichment

### Enriched Data Tables

During the enrichment phase, measurement data is augmented with additional timestamp columns to support both UTC and local time views:

#### Timestamp Columns

- **timestamp_utc**: An alias of the normalized UTC timestamp for clarity. This is the same value as the `timestamp` field, which is kept for backwards compatibility with downstream consumers that order by `timestamp`.
- **timestamp_local**: The full local date and time formatted as "yyyy-MM-dd HH:mm:ss". This column is computed by converting `timestamp_utc` to the timezone specified in the `timezone` field. It will be null for measurements without timezone information.
- **time_local**: The local time only, formatted as "HH:mm". Like `timestamp_local`, this is derived by converting `timestamp_utc` using the `timezone` field and will be null when timezone information is not available.

These local time columns are computed on-the-fly during the enrichment process using PySpark's `from_utc_timestamp` function with the user's timezone.

#### Display Ordering

In data table views, the timestamp columns are pinned to the front in the following order for user visibility:
1. `timestamp_local`
2. `time_local`
3. `timestamp_utc`

### Timestamp Processing Principles

- The UTC timestamp (`timestamp`/`timestamp_utc`) remains the source of truth for all temporal operations and ordering
- Local time representations (`timestamp_local`, `time_local`) are derived values, never stored separately
- The `timezone` field is captured once at measurement time and propagates through the pipeline
- Legacy data without timezone information will have null values for all local time columns