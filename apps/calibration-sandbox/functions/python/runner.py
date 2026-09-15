"""Runs one calibration script, and nothing else, in its own process.

The handler never executes a script itself. It writes the run event here and
starts this module as a subprocess with a stripped environment, so a script
cannot read the function's credentials and cannot leave state behind for the
next tenant's run in a warm container. The only channel back is one JSON
document on stdout.
"""

import json
import math
import sys
import traceback

import pandas as pd

TRACEBACK_TAIL_LINES = 20


def _as_plain_list(value):
    """A list, or a numpy array, as a plain list; else None."""
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


def _run(event):
    inputs = {name: pd.DataFrame(rows) for name, rows in (event.get("series") or {}).items()}
    params = event.get("params") or {}
    submissions = []

    def submit(blocks):
        submissions.append(blocks)

    scope = {"inputs": inputs, "params": params, "submit": submit}
    try:
        exec(compile(event["script"], "<calibration-script>", "exec"), scope)
    except Exception as exc:
        return {
            "outcome": "script_failed",
            "error": "".join(traceback.format_exception_only(type(exc), exc)).strip(),
            "trace": "".join(traceback.format_exc()).splitlines()[-TRACEBACK_TAIL_LINES:],
        }

    if len(submissions) == 0:
        return {"outcome": "no_submit"}
    if len(submissions) > 1:
        return {"outcome": "many_submits"}
    if not isinstance(submissions[0], dict):
        return {"outcome": "not_a_dict"}

    return {"outcome": "submitted", "blocks": _jsonable(submissions[0])}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"outcome": "runner_failed", "error": "Usage: runner.py <event.json>"}))
        return
    try:
        with open(sys.argv[1], "r") as handle:
            event = json.load(handle)
        result = _run(event)
    except Exception as exc:
        # The handler turns this into an infrastructure error, not a script fault.
        result = {"outcome": "runner_failed", "error": f"{type(exc).__name__}"}
    print(json.dumps(result))


if __name__ == "__main__":
    main()
