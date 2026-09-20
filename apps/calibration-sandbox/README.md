# Calibration Sandbox

One generic AWS Lambda that executes device-calibration scripts. The event
carries everything (script, captured series, parameters, output schema); the
script receives three names (`inputs`, `params`, `submit`), and the handler
validates the submitted blocks against the schema before returning
synchronously. Nothing family-specific lives here.

## Trust model

A definition is authored by any user, so the script is treated as hostile. Two
walls stand between it and the function.

`handler.py` never executes it. It writes the run event to a private temporary
file and starts `lib/wrappers/wrapper.py` as a separate process with an
environment stripped to `PATH`, `HOME`, `PYTHONPATH` and
`PYTHONDONTWRITEBYTECODE`, a wall-clock limit and a capped reply on stdout. A
script therefore cannot read this function's credentials, cannot outlive its own
invocation, and cannot leave state behind for the next run in a warm container.

Inside that process the wrapper runs the script against an allowlisted
`__builtins__` and the same `SafeModule` / `SafeCallable` / `SafeClass` proxies
the macro sandbox uses: no `open`, no `eval`, no `getattr`, and no writing to a
module. A bare value is no proxy, so a dunder anywhere in the script is refused
before it is compiled, which closes the walk from `().__class__` out to every
loaded class. Imports are allowlisted rather than removed, to `qc`, `numpy`,
`pandas`, `scipy`, `math` and `statistics`, because a calibration script is
ported from a notebook and reads as one.

`tests/test_isolation.py` holds both walls, including a script that tries to
disable the quality gate for whoever calibrates next.

Human approval remains the gate before any coefficient reaches a device. A block
whose quality gate failed is rejected by the script and kept on record with its
reasons, as the bench tool keeps a device's existing gain; the thresholds are the
platform's until a scientist supplies real ones.

`lib/helpers/qc.py` holds one set of quality gates for every definition, so two
scripts fitting the same kind of curve cannot disagree about what passes.

## Develop

Everything runs through Docker; there is no host Python toolchain to install.

```bash
pnpm --filter calibration-sandbox test    # unit tests, inside the image
pnpm --filter calibration-sandbox build   # build the Lambda image
pnpm --filter calibration-sandbox dev     # run it locally on :9004
pnpm --filter calibration-sandbox invoke  # send test/event.json to it
```

`test` skips itself when Docker is unavailable. `test:run` mounts `tests/` into
a freshly built image and runs them against the handler, wrapper and gates as
they are actually shipped.

`test/event.json` runs the automated MiniPAR fit over synthetic readings placed
on the line the manual bench really fitted, so a healthy container answers a
slope of 0.96 and an intercept of -1.08. No recording of a real sweep exists;
the notebooks the procedures come from saved only their results.

## Invoke it from the backend

The generated backend env already points at the local container:
`AWS_LAMBDA_CALIBRATION_SANDBOX_ENDPOINT=http://localhost:9004` and
`AWS_LAMBDA_CALIBRATION_SANDBOX_FUNCTION_NAME=function`. The name is not
arbitrary: `function` is what the Lambda runtime interface emulator answers to,
so the backend's request is the same one `pnpm invoke` sends. With the container
up and `pnpm dev:fb` running, a calibration run created from the platform is
computed here. A stopped container surfaces on the run as a refused connection.
Unset the endpoint to invoke the deployed function instead.
