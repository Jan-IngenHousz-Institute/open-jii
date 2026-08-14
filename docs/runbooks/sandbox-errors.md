# sandbox-errors

Macro sandbox Lambda errors/throttles above baseline.

Likely causes: a newly created/updated user macro failing at scale; runtime image regression after deploy; concurrency limit hit during batch enrichment from the pipeline.

First moves: which function (language) is failing; sample the failing macro ids from logs; if throttling during pipeline enrichment, check execute-macro-batch fan-out and reserved concurrency.
