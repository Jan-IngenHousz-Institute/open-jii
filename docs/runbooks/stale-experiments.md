# stale-experiments

Active experiments with bound devices have stopped receiving data (experiment_status stale) while the pipeline itself is healthy.

Likely causes: devices offline in the field (battery, connectivity); device config lost after credential rotation; topic prefix mismatch after onboarding changes.

First moves: roster in the heartbeat S3 detail (which experiments, which devices); cross-check silent-devices; if one experiment only, suspect its devices; if many, suspect ingest path and check ingest-lag/forwarding failures first.
