# Calibration Sandbox

One generic AWS Lambda that executes device-calibration scripts. The event
carries everything (script, captured series, parameters, output schema); the
handler injects three names into the script (`inputs`, `params`, `submit`),
validates the submitted blocks against the schema and their QC records, and
returns the result synchronously. Nothing family-specific lives here.

Unlike `apps/macro-sandbox`, isolation is boundary-level (isolated-VPC Lambda
with zero egress), not in-process exec hardening: calibration scripts get real
imports from the image's curated package set by design.

The trust model that implies: definitions are versioned, reviewable artifacts,
and human approval is the security gate before any coefficient takes effect.
In-process validation guards honest mistakes, not malice; a hostile script
could patch this process, including state a warm container carries into later
invokes. Accepted for v1. If definitions ever become less trusted, the
hardening path is one subprocess per invoke, macro-sandbox style.

`functions/python/qc.py` holds one set of quality gates for every definition, so
two scripts fitting the same kind of curve cannot disagree about what passes.

## Develop

```bash
pnpm --filter calibration-sandbox test    # unit tests (uv-managed Python 3.12)
pnpm --filter calibration-sandbox build   # build the Lambda image
pnpm --filter calibration-sandbox dev     # run it locally on :9011
pnpm --filter calibration-sandbox invoke  # send test/event.json to it
```

Author a script against an exported bench payload without any of the above:

```bash
uv run python devshim.py my_script.py payload.json
```
