"""Calibration sandbox Lambda: validates a run event, has the wrapper execute the
calibration script in its own process, and checks what it submits against the
output schema.

The script never runs in this process. A calibration definition is authored by
any user, so its script gets a fresh interpreter with a stripped environment,
a wall-clock limit and a capped reply: it cannot read this function's
credentials, and it cannot leave state behind for the next run in a warm
container.
"""

import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import threading

BLOCK_KEYS = {"status", "coefficients", "fit", "quality", "reason"}
BLOCK_STATUSES = {"computed", "rejected", "skipped"}

# The API's own limits on a block's free text, mirrored so a block this handler accepts
# is one the platform stores; one it would refuse is explained here, where the reason
# reaches the operator, rather than lost as an unrecognised payload.
REASON_MAX_CHARS = 2000
RECORD_MAX_BYTES = 16 * 1024

WRAPPER_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wrappers", "wrapper.py")
SCRIPT_TIMEOUT_SECONDS = 30
MAX_RUNNER_OUTPUT_BYTES = 10 * 1024 * 1024
MAX_RUNNER_STDERR_BYTES = 64 * 1024
TEMP_PREFIX = "calibration_"


class _Drain(threading.Thread):
    """Reads a pipe to its end as it fills, keeping the first `cap` bytes.

    Collecting a pipe after the process exits means holding everything it wrote, so a
    script that submits megabytes takes the function down instead of failing its run.
    Once the cap is passed the process is killed and the rest is read and dropped.
    """

    def __init__(self, stream, cap, process):
        super().__init__(daemon=True)
        self.stream = stream
        self.cap = cap
        self.process = process
        self.kept = bytearray()
        self.total = 0
        self.start()

    def run(self):
        while True:
            chunk = self.stream.read(65536)
            if not chunk:
                return
            room = self.cap - len(self.kept)
            if room > 0:
                self.kept.extend(chunk[:room])
            self.total += len(chunk)
            if self.total > self.cap:
                self.process.kill()

    def text(self):
        return bytes(self.kept).decode("utf-8", errors="replace")


def handler(event, context):
    try:
        return _execute(event)
    except Exception as exc:
        # Never leak handler internals to the caller.
        return {"status": "error", "error": f"Handler error: {type(exc).__name__}"}


def _execute(event):
    if not isinstance(event, dict):
        return _error("Event must be an object")

    script = event.get("script")
    if not isinstance(script, str) or not script.strip():
        return _error("Missing 'script'")

    series = event.get("series") or {}
    if not isinstance(series, dict):
        return _error("'series' must be an object of row arrays")

    params = event.get("params") or {}
    if not isinstance(params, dict):
        return _error("'params' must be an object")

    blocks_spec = (event.get("outputSchema") or {}).get("blocks")
    if not isinstance(blocks_spec, dict) or not blocks_spec:
        return _error("'outputSchema.blocks' must be a non-empty object")

    for name, rows in series.items():
        if not isinstance(rows, list):
            return _error(f"Series '{name}' must be an array of rows")

    outcome = _run_script_in_subprocess(
        {"script": script, "series": series, "params": params}
    )
    if outcome.get("outcome") != "submitted":
        return _describe_failed_run(outcome)

    blocks = _fill_unattempted(outcome["blocks"], blocks_spec)
    reasons = _validate_blocks(blocks, blocks_spec)
    if reasons:
        return _compute_failed("Submitted blocks failed validation", reasons=reasons)

    return {"status": "computed", "blocks": blocks}


def _fill_unattempted(blocks, spec):
    """Record a declared block the script never mentioned as skipped."""
    filled = dict(blocks)
    for name in spec:
        if name not in filled:
            filled[name] = {"status": "skipped", "reason": "not produced by the script"}
    return filled


def _validate_blocks(blocks, spec):
    """Check every block's shape, and the coefficients of the computed ones."""
    reasons = []
    for name in blocks.keys() - spec.keys():
        reasons.append(f"Block '{name}' is not declared in the output schema")

    for name, block in blocks.items():
        if name not in spec:
            continue
        if not isinstance(block, dict):
            reasons.append(f"Block '{name}' must be a dict")
            continue

        for key in block.keys() - BLOCK_KEYS:
            reasons.append(f"Block '{name}' has unknown key '{key}'")
        for key in ("fit", "quality"):
            if key in block and not isinstance(block[key], dict):
                reasons.append(f"Block '{name}' {key} must be a dict")
            elif key in block and len(json.dumps(block[key])) > RECORD_MAX_BYTES:
                reasons.append(
                    f"Block '{name}' {key} must serialise to at most {RECORD_MAX_BYTES} bytes"
                )
        reason = block.get("reason")
        if reason is not None and (not isinstance(reason, str) or len(reason) > REASON_MAX_CHARS):
            reasons.append(
                f"Block '{name}' reason must be a string of at most {REASON_MAX_CHARS} characters"
            )

        status = block.get("status")
        if not isinstance(status, str) or status not in BLOCK_STATUSES:
            reasons.append(
                f"Block '{name}' needs a status of {', '.join(sorted(BLOCK_STATUSES))}"
            )
            continue

        has_coefficients = "coefficients" in block
        if status == "computed" and not has_coefficients:
            reasons.append(f"Block '{name}' is computed but carries no coefficients")
            continue
        if status != "computed" and has_coefficients:
            reasons.append(f"Block '{name}' is {status} but still carries coefficients")
            continue

        if status != "computed":
            continue

        # A failed quality record is advisory: the thresholds are the platform's
        # until a scientist supplies real ones, so it travels with the block and
        # the person approving the run decides.

        reasons.extend(_validate_coefficients(name, block.get("coefficients"), spec[name]))

    return reasons


def _validate_coefficients(block_name, coefficients, coefficient_specs):
    if not isinstance(coefficients, dict):
        return [f"Block '{block_name}' must carry a coefficients dict"]

    reasons = []
    for name in coefficient_specs.keys() - coefficients.keys():
        reasons.append(f"Coefficient '{block_name}.{name}' is required but missing")
    for name in coefficients.keys() - coefficient_specs.keys():
        reasons.append(f"Coefficient '{block_name}.{name}' is not declared in the output schema")

    for name, value in coefficients.items():
        spec = coefficient_specs.get(name)
        if spec is None:
            continue
        label = f"{block_name}.{name}"
        if spec.get("type") == "number":
            reasons.extend(_check_number(label, value, spec))
        elif spec.get("type") == "integer_array":
            reasons.extend(_check_array(label, value, spec, integers=True))
        elif spec.get("type") == "number_array":
            reasons.extend(_check_array(label, value, spec, integers=False))
        else:
            reasons.append(f"Coefficient '{label}' has an unknown spec type")

    return reasons


def _check_number(label, value, spec):
    # numpy integer scalars subclass neither int nor float; unwrap them first.
    if hasattr(value, "item"):
        value = value.item()
    # A non-finite float cannot cross JSON, so it arrives here as null: both
    # that and a non-number are the same fault to the person reading the run.
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return [f"Coefficient '{label}' must be a finite number"]
    reasons = []
    if "min" in spec and value < spec["min"]:
        reasons.append(f"Coefficient '{label}' is below the allowed minimum {spec['min']}")
    if "max" in spec and value > spec["max"]:
        reasons.append(f"Coefficient '{label}' is above the allowed maximum {spec['max']}")
    return reasons


def _check_array(label, value, spec, integers):
    values = _as_plain_list(value)
    if values is None:
        return [f"Coefficient '{label}' must be {'an integer' if integers else 'a number'} array"]
    if len(values) != spec["length"]:
        return [f"Coefficient '{label}' must have exactly {spec['length']} entries"]
    reasons = []
    for index, entry in enumerate(values):
        if integers and (isinstance(entry, bool) or not isinstance(entry, int)):
            reasons.append(f"Coefficient '{label}[{index}]' must be an integer")
        elif not _is_finite_number(entry):
            reasons.append(f"Coefficient '{label}[{index}]' must be a finite number")
        elif "min" in spec and entry < spec["min"]:
            reasons.append(f"Coefficient '{label}[{index}]' is below the allowed minimum")
        elif "max" in spec and entry > spec["max"]:
            reasons.append(f"Coefficient '{label}[{index}]' is above the allowed maximum")
    return reasons


def _is_finite_number(entry):
    # A non-finite float arrives as None once it has crossed the wrapper's JSON line.
    return not isinstance(entry, bool) and isinstance(entry, (int, float)) and math.isfinite(entry)


def _as_plain_list(value):
    """A list, or a numpy array, as a plain list of Python scalars; else None."""
    if hasattr(value, "tolist"):
        value = value.tolist()
    if not isinstance(value, list):
        return None
    return [entry.item() if hasattr(entry, "item") else entry for entry in value]


def _run_script_in_subprocess(payload):
    """Hand the run to the wrapper and read back its single JSON line."""
    _remove_stale_temp_dirs()
    workdir = tempfile.mkdtemp(prefix=TEMP_PREFIX)
    try:
        event_path = os.path.join(workdir, "event.json")
        with open(
            event_path, "w", opener=lambda path, flags: os.open(path, flags, 0o600)
        ) as handle:
            json.dump(payload, handle)

        process = subprocess.Popen(
            # The interpreter that already has numpy, pandas and scipy.
            [sys.executable, WRAPPER_PATH, event_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            # The environment is stripped so nothing of the function's reaches the script
            # by name; what shares the function's user is the wrapper's audit hook's job.
            env={
                "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
                # Both point at the directory this run is torn down with, so a cache a
                # library writes on its own cannot outlive the run on a warm container.
                "HOME": workdir,
                "TMPDIR": workdir,
                "PYTHONPATH": os.path.dirname(WRAPPER_PATH),
                "PYTHONDONTWRITEBYTECODE": "1",
            },
        )
        out = _Drain(process.stdout, MAX_RUNNER_OUTPUT_BYTES, process)
        err = _Drain(process.stderr, MAX_RUNNER_STDERR_BYTES, process)
        try:
            process.wait(timeout=SCRIPT_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
            _close_pipes(process, out, err)
            return {
                "outcome": "timed_out",
                "error": f"Script exceeded {SCRIPT_TIMEOUT_SECONDS}s",
            }
        _close_pipes(process, out, err)

        if out.total > MAX_RUNNER_OUTPUT_BYTES:
            return {"outcome": "too_large"}
        stdout = out.text().strip()
        if not stdout:
            return {"outcome": "no_output", "error": _tail(err.text())}
        try:
            return json.loads(stdout)
        except json.JSONDecodeError:
            return {"outcome": "bad_output"}
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def _close_pipes(process, out, err):
    """Wait for both drains, then release the pipes the process left behind."""
    out.join()
    err.join()
    process.stdout.close()
    process.stderr.close()


def _remove_stale_temp_dirs():
    """A crashed prior invocation can leave a directory behind on a warm container."""
    root = tempfile.gettempdir()
    try:
        names = os.listdir(root)
    except OSError:
        return
    for name in names:
        if name.startswith(TEMP_PREFIX):
            shutil.rmtree(os.path.join(root, name), ignore_errors=True)


def _tail(text, limit=500):
    stripped = (text or "").strip()
    return stripped[-limit:] if stripped else ""


def _describe_failed_run(outcome):
    kind = outcome.get("outcome")
    if kind == "script_failed":
        return _compute_failed(outcome.get("error", "Script failed"), trace=outcome.get("trace"))
    if kind == "no_submit":
        return _compute_failed("Script finished without calling submit()")
    if kind == "many_submits":
        return _compute_failed("submit() must be called exactly once")
    if kind == "not_a_dict":
        return _compute_failed("submit() takes blocks as a dict keyed by block name")
    if kind == "timed_out":
        return _compute_failed(outcome.get("error", "Script timed out"))
    if kind == "too_large":
        return _compute_failed("Script produced more output than the sandbox accepts")
    # no_output, bad_output and runner_failed are the sandbox's fault, not the
    # script's, so they surface as infrastructure errors.
    return _error("The calibration sandbox did not return a usable result")


def _error(message):
    return {"status": "error", "error": message}


def _compute_failed(message, *, reasons=None, trace=None):
    failure = {"status": "compute_failed", "error": message}
    if reasons:
        failure["reasons"] = reasons
    if trace:
        failure["traceback"] = trace
    return failure
