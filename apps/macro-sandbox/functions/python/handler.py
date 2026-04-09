import json
import base64
import subprocess
import os
import shutil
import tempfile

# Limits
MAX_SCRIPT_SIZE = 1 * 1024 * 1024  # 1MB
MAX_OUTPUT_SIZE = 10 * 1024 * 1024  # 10MB
MAX_ITEM_COUNT = 1000
MAX_TIMEOUT = 60
DEFAULT_TIMEOUT = 10

WRAPPER_PATH = "/var/task/wrappers/wrapper.py"


def _cleanup_stale_tmp():
    """Remove leftover macro temp dirs from crashed prior invocations (warm-start safety)."""
    import glob
    for d in glob.glob("/tmp/macro_*"):
        shutil.rmtree(d, ignore_errors=True)


def handler(event, context):
    try:
        return _execute(event)
    except Exception as e:
    # Never leak internal details to caller
        return {
            "status": "error",
            "results": [],
            "errors": [f"Handler error: {type(e).__name__}"],
        }


def _execute(event):
    _cleanup_stale_tmp()

    # Validate script
    if "script" not in event:
        return {"status": "error", "results": [], "errors": ["Missing 'script' field"]}

    try:
        script_bytes = base64.b64decode(event["script"])
    except Exception:
        return {"status": "error", "results": [], "errors": ["Invalid base64 in 'script'"]}

    if len(script_bytes) > MAX_SCRIPT_SIZE:
        return {"status": "error", "results": [], "errors": ["Script exceeds 1MB limit"]}

    script_content = script_bytes.decode("utf-8")

    # Validate items
    items = event.get("items", [])
    if not isinstance(items, list):
        return {"status": "error", "results": [], "errors": ["'items' must be an array"]}
    if len(items) > MAX_ITEM_COUNT:
        return {
            "status": "error",
            "results": [],
            "errors": [f"Exceeds {MAX_ITEM_COUNT} item limit"],
        }

    timeout = min(int(event.get("timeout", DEFAULT_TIMEOUT)), MAX_TIMEOUT)

    # Write to temp files
    tmpdir = tempfile.mkdtemp(prefix="macro_", dir="/tmp")
    try:
        script_path = os.path.join(tmpdir, "script")
        input_path = os.path.join(tmpdir, "input.json")

        with open(
            script_path,
            "w",
            opener=lambda path, flags: os.open(path, flags, 0o600),
        ) as f:
            f.write(script_content)
        with open(
            input_path,
            "w",
            opener=lambda path, flags: os.open(path, flags, 0o600),
        ) as f:
            json.dump(items, f)

        # Run wrapper in a subprocess with a stripped environment.
        result = subprocess.run(
            ["python3", WRAPPER_PATH, script_path, input_path],
            capture_output=True,
            text=True,
            timeout=timeout + 5,  # Buffer for wrapper overhead
            env={
                "PATH": "/var/lang/bin:/usr/local/bin:/usr/bin:/bin",
                "HOME": "/tmp",
                "PYTHONPATH": "/var/task/src/helpers:/var/task",
                "PYTHONDONTWRITEBYTECODE": "1",
            },
        )

        stdout = result.stdout.strip()
        if len(stdout) > MAX_OUTPUT_SIZE:
            return {
                "status": "error",
                "results": [],
                "errors": ["Wrapper output exceeds 10MB limit"],
            }
        if stdout:
            try:
                return json.loads(stdout)
            except json.JSONDecodeError:
                return {
                    "status": "error",
                    "results": [],
                    "errors": ["Wrapper returned invalid JSON"],
                }
        else:
            return {
                "status": "error",
                "results": [],
                "errors": ["Wrapper returned no output"],
            }

    except subprocess.TimeoutExpired:
        return {"status": "error", "results": [], "errors": ["Execution timed out"]}
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
