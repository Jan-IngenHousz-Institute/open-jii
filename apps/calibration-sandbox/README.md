# Calibration Sandbox

One generic AWS Lambda that executes device-calibration scripts. The event
carries everything (script, captured series, parameters, output schema); the
script receives `inputs`, `params` and `submit`, plus `np`, `pd`, `scipy` and
`qc` already imported, and the handler validates the submitted blocks against
the schema before returning synchronously. Nothing family-specific lives here.

## Trust model

A definition is authored by any user, so the script is treated as hostile. The
boundary that holds against it is the function itself: an execution role that
may do nothing but write its own logs, and a security group that reaches only
the VPC endpoints. Everything inside the process is a layer that turns an
escape into an error at the call, not a boundary of its own, and it is
described that way here so nobody relies on it for more.

`handler.py` never executes the script. It writes the run event to a private
temporary file and starts `lib/wrappers/wrapper.py` as a separate process with
an environment stripped to `PATH`, `HOME`, `PYTHONPATH` and
`PYTHONDONTWRITEBYTECODE`, a wall-clock limit, and both pipes drained as they
fill: past 10 MiB on stdout the process is killed and the run fails, rather
than the function holding the output until it runs out of memory. What the
script prints is kept to 64 KiB for its traceback. The stripped environment
keeps the credentials out of the script's own `os.environ`; it does not keep
them out of `/proc`, because the wrapper shares the runtime's user. That is
what the audit hook below is for.

Inside that process the wrapper runs the script against an allowlisted
`__builtins__` and the same `SafeModule` / `SafeCallable` / `SafeClass` proxies
the macro sandbox uses: no `open`, no `eval`, no `getattr`, and no writing to a
module. A bare value is no proxy, so a dunder anywhere in the script is refused
before it is compiled, which closes the walk from `().__class__` out to every
loaded class. Imports are allowlisted rather than removed, to `qc`, `numpy`,
`pandas`, `scipy`, `math`, `statistics`, `json` and `re`, because a calibration
script is ported from a notebook and reads as one.

Those libraries can read any path, open any URL and write any file on their
own, so before the script runs the wrapper installs a `sys.addaudithook` that
refuses every `open` for writing, every `open` for reading outside the
interpreter and the shared helpers, and every socket, process, filesystem and
`ctypes` event. `pd.read_csv("/proc/1/environ")`, `pd.read_csv("http://…")`,
`pd.read_pickle`, `DataFrame.to_csv`, `np.save` and `np.fromfile` all fail at
the call with a `PermissionError` naming what was refused. The image runs as an
unprivileged user, so its own files, the gates included, are read-only to a
script even on a local container where the filesystem is writable.

`tests/test_isolation.py` holds all of this, including a script that tries to
disable the quality gate for whoever calibrates next and each of the library
escapes above.

Human approval remains the gate before any coefficient reaches a device. The
runtime does not reject a block on its quality record: that is the script's
decision, and every seeded script rejects a block whose gate failed and keeps
its reasons on record, as the bench tool keeps a device's existing gain. The
thresholds are the platform's until a scientist supplies real ones.

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
