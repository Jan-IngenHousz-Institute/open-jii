# Project Transfers

Project transfers allow you to import experiments, protocols, macros, and measurement data from external platforms (such as PhotosynQ) into openJII.

## How it works

1. A **transfer request** is submitted, specifying the source project and the openJII user who should own the imported experiment.
2. The system validates ownership — the requesting user's email must match the source project owner.
3. On approval, the transfer pipeline automatically:
   - Creates or reuses a **protocol** (matched by name to avoid duplicates)
   - Creates or reuses a **macro** (matched by name)
   - Creates a new **experiment** with the requesting user as admin
   - Associates the protocol with the experiment
   - Attaches location data if available
   - Builds a measurement flow from any questions defined in the source project
4. Measurement data is written as Parquet files into the data import volume.
5. The centralized pipeline picks up imported data via Auto Loader and processes it through the standard Bronze → Silver → Gold medallion layers.
6. A confirmation email is sent to the user when the transfer completes.

## Transfer statuses

| Status | Meaning |
| ------ | ------- |
| Pending | Request submitted, awaiting validation |
| Approved | Validation passed, transfer in progress |
| Completed | All data imported successfully |
| Failed | Transfer encountered an error |
| Rejected | Validation failed (e.g. ownership mismatch) |

## Data handling

- Imported measurements include a `skip_macro_processing` flag — macro outputs from the source platform are preserved as-is, avoiding redundant re-execution.
- Imported data follows the same quality and transformation pipeline as native measurements once it enters the Silver layer.
- All imported data maintains lineage back to the source platform for traceability.
