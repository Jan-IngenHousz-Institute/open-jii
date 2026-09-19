# Calibration Sandbox

One generic AWS Lambda that executes device-calibration scripts. The event
carries everything (script, captured series, parameters, output schema); the
script receives three names (`inputs`, `params`, `submit`), and the handler
validates the submitted blocks against the schema before returning
synchronously. Nothing family-specific lives here.

## Trust model

A definition is authored by any user, so the script is treated as hostile.
`handler.py` never executes it. It writes the run event to a private temporary
file and starts `runner.py` as a separate process with an environment stripped
to `PATH`, `HOME`, `PYTHONPATH` and `PYTHONDONTWRITEBYTECODE`, a wall-clock
limit and a capped reply on stdout. A script therefore cannot read this
function's credentials, cannot outlive its own invocation, and cannot leave
state behind for the next run in a warm container. `tests/test_isolation.py`
holds those four properties, including a script that tries to disable the
quality gate for whoever calibrates next.

Scripts still get real imports from the image's curated package set, which is
the point: fitting needs numpy, pandas and scipy. The process boundary, not a
restricted interpreter, is what contains them.

Human approval remains the gate before any coefficient reaches a device, and a
quality record is advisory: the thresholds are the platform's until a scientist
supplies real ones.

`functions/python/qc.py` holds one set of quality gates for every definition, so
two scripts fitting the same kind of curve cannot disagree about what passes.

## Develop

```bash
pnpm --filter calibration-sandbox test    # unit tests (uv-managed Python 3.12)
pnpm --filter calibration-sandbox build   # build the Lambda image
pnpm --filter calibration-sandbox dev     # run it locally on :9004
pnpm --filter calibration-sandbox invoke  # send test/event.json to it
```

`test/event.json` runs the automated MiniPAR fit over synthetic readings placed
on the line the manual bench really fitted, so a healthy container answers a
slope of 0.96 and an intercept of -1.08. No recording of a real sweep exists;
the notebooks the procedures come from saved only their results.

Author a script against an exported bench payload without any of the above:

```bash
uv run python devshim.py my_script.py payload.json
```

## Invoke it from the backend

The generated backend env already points at the local container:
`AWS_LAMBDA_CALIBRATION_SANDBOX_ENDPOINT=http://localhost:9004` and
`AWS_LAMBDA_CALIBRATION_SANDBOX_FUNCTION_NAME=function`. The name is not
arbitrary: `function` is what the Lambda runtime interface emulator answers to,
so the backend's request is the same one `pnpm invoke` sends. With the container
up and `pnpm dev:fb` running, a calibration run created from the platform is
computed here. A stopped container surfaces on the run as a refused connection.
Unset the endpoint to invoke the deployed function instead.
