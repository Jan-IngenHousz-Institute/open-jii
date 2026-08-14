# metrics-mv-freshness

Public metrics schema MVs are stale; the public metrics page is showing old numbers (publicly visible).

Likely causes: metrics DLT pipeline failed/paused; scheduler job broken; upstream centrum stall (check ingest-lag / dlt-heartbeat first: this may be a symptom).

First moves: metrics pipeline update history; if centrum is also stale, fix upstream first; the public endpoint serves cached values meanwhile (stale-on-error).
