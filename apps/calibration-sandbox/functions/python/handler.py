"""Calibration sandbox Lambda: runs one calibration script per invoke against the
captured series and validates what it submits against the output schema.
"""

import math
import traceback

import pandas as pd

TRACEBACK_TAIL_LINES = 20
BLOCK_KEYS = {"status", "coefficients", "fit", "quality", "reason"}
BLOCK_STATUSES = {"computed", "rejected", "skipped"}


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

    inputs = {}
    for name, rows in series.items():
        if not isinstance(rows, list):
            return _error(f"Series '{name}' must be an array of rows")
        inputs[name] = pd.DataFrame(rows)

    submissions = []

    def submit(blocks):
        submissions.append(blocks)

    scope = {"inputs": inputs, "params": params, "submit": submit}
    try:
        exec(compile(script, "<calibration-script>", "exec"), scope)
    except Exception as exc:
        return _compute_failed(
            "".join(traceback.format_exception_only(type(exc), exc)).strip(),
            trace="".join(traceback.format_exc()).splitlines()[-TRACEBACK_TAIL_LINES:],
        )

    if len(submissions) == 0:
        return _compute_failed("Script finished without calling submit()")
    if len(submissions) > 1:
        return _compute_failed("submit() must be called exactly once")

    blocks = submissions[0]
    if not isinstance(blocks, dict):
        return _compute_failed("submit() takes blocks as a dict keyed by block name")

    blocks = _fill_unattempted(blocks, blocks_spec)
    reasons = _validate_blocks(blocks, blocks_spec)
    if reasons:
        return _compute_failed("Submitted blocks failed validation", reasons=reasons)

    return {"status": "computed", "blocks": _jsonable(blocks)}


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

        status = block.get("status")
        if status not in BLOCK_STATUSES:
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

        quality = block.get("quality")
        if isinstance(quality, dict) and quality.get("passed") is False:
            qc_reasons = quality.get("reasons") or ["no reasons reported"]
            reasons.append(
                f"Block '{name}' is computed but its QC gates failed "
                f"({'; '.join(map(str, qc_reasons))}); mark it rejected instead"
            )

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
            reasons.extend(_check_integer_array(label, value, spec))
        else:
            reasons.append(f"Coefficient '{label}' has an unknown spec type")

    return reasons


def _check_number(label, value, spec):
    # numpy integer scalars subclass neither int nor float; unwrap them first.
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return [f"Coefficient '{label}' must be a number"]
    if not math.isfinite(value):
        return [f"Coefficient '{label}' must be finite"]
    reasons = []
    if "min" in spec and value < spec["min"]:
        reasons.append(f"Coefficient '{label}' is below the allowed minimum {spec['min']}")
    if "max" in spec and value > spec["max"]:
        reasons.append(f"Coefficient '{label}' is above the allowed maximum {spec['max']}")
    return reasons


def _check_integer_array(label, value, spec):
    values = _as_plain_list(value)
    if values is None:
        return [f"Coefficient '{label}' must be an integer array"]
    if len(values) != spec["length"]:
        return [f"Coefficient '{label}' must have exactly {spec['length']} entries"]
    reasons = []
    for index, entry in enumerate(values):
        if isinstance(entry, bool) or not isinstance(entry, int):
            reasons.append(f"Coefficient '{label}[{index}]' must be an integer")
        elif "min" in spec and entry < spec["min"]:
            reasons.append(f"Coefficient '{label}[{index}]' is below the allowed minimum")
        elif "max" in spec and entry > spec["max"]:
            reasons.append(f"Coefficient '{label}[{index}]' is above the allowed maximum")
    return reasons


def _as_plain_list(value):
    """A list, or a numpy array of integers, as a plain int list; else None."""
    if hasattr(value, "tolist"):
        value = value.tolist()
    if not isinstance(value, list):
        return None
    return [entry.item() if hasattr(entry, "item") else entry for entry in value]


def _jsonable(value):
    """Coerce numpy scalars/arrays and non-finite floats into JSON-safe values."""
    if isinstance(value, bool) or value is None or isinstance(value, str):
        return value
    if hasattr(value, "tolist"):
        value = value.tolist()
    elif hasattr(value, "item"):
        value = value.item()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, dict):
        return {str(key): _jsonable(entry) for key, entry in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(entry) for entry in value]
    return str(value)


def _error(message):
    return {"status": "error", "error": message}


def _compute_failed(message, *, reasons=None, trace=None):
    failure = {"status": "compute_failed", "error": message}
    if reasons:
        failure["reasons"] = reasons
    if trace:
        failure["traceback"] = trace
    return failure
