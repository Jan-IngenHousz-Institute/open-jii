import json
import base64
import gzip
import subprocess
import threading
import os
import shutil
import tempfile


# AWS Lambda sync responses are capped at 6 MB. Compress every response so
# macro outputs of ~25-50 MB raw can still fit. Callers detect the
# {encoding, payload} wrapper and decompress.
def _compress_response(envelope):
    body = json.dumps(envelope).encode("utf-8")
    compressed = gzip.compress(body)
    return {
        "encoding": "gzip+base64",
        "payload": base64.b64encode(compressed).decode("ascii"),
    }

# Limits
MAX_SCRIPT_SIZE = 1 * 1024 * 1024  # 1MB
MAX_OUTPUT_SIZE = 10 * 1024 * 1024  # 10MB
MAX_STDERR_SIZE = 64 * 1024


class _Drain(threading.Thread):
    """Reads a pipe to its end as it fills, keeping the first `cap` bytes.

    Collecting a pipe after the process exits means holding everything it wrote, so a
    macro that returns megabytes per item takes the function down instead of failing
    its batch. Once the cap is passed the process is killed and the rest is read and
    dropped.
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


def _close_pipes(process, out, err):
    """Wait for both drains, then release the pipes the process left behind."""
    out.join()
    err.join()
    process.stdout.close()
    process.stderr.close()
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
        result = _execute(event)
    except Exception as e:
        # Never leak internal details to caller
        result = {
            "status": "error",
            "results": [],
            "errors": [f"Handler error: {type(e).__name__}"],
        }
    return _compress_response(result)


def _execute(event):
    _cleanup_stale_tmp()

    # Validate script
    if "script" not in event:
        return {"status": "error", "results": [], "errors": ["Missing 'script' field"]}

    try:
        script_bytes = base64.b64decode(event["script"])
        if len(script_bytes) > MAX_SCRIPT_SIZE:
            return {"status": "error", "results": [], "errors": ["Script exceeds 1MB limit"]}
        script_content = script_bytes.decode("utf-8")
    except Exception:
        return {"status": "error", "results": [], "errors": ["Invalid base64 or encoding in 'script'"]}

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

    timeout = max(DEFAULT_TIMEOUT, min(int(event.get("timeout", DEFAULT_TIMEOUT)), MAX_TIMEOUT))

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

        # Run wrapper in a subprocess with a stripped environment. Its pipes are drained
        # as they fill, so output is bounded before it is held rather than after.
        process = subprocess.Popen(
            ["python3", WRAPPER_PATH, script_path, input_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={
                "PATH": "/var/lang/bin:/usr/local/bin:/usr/bin:/bin",
                "HOME": "/tmp",
                "PYTHONPATH": "/var/task/src/helpers:/var/task",
                "PYTHONDONTWRITEBYTECODE": "1",
            },
        )
        out = _Drain(process.stdout, MAX_OUTPUT_SIZE, process)
        err = _Drain(process.stderr, MAX_STDERR_SIZE, process)
        try:
            process.wait(timeout=timeout + 5)  # Buffer for wrapper overhead
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
            _close_pipes(process, out, err)
            return {"status": "error", "results": [], "errors": ["Execution timed out"]}
        _close_pipes(process, out, err)

        if out.total > MAX_OUTPUT_SIZE:
            return {
                "status": "error",
                "results": [],
                "errors": ["Wrapper output exceeds 10MB limit"],
            }
        stdout = out.text().strip()
        if stdout:
            try:
                parsed = json.loads(stdout)
            except json.JSONDecodeError:
                return {
                    "status": "error",
                    "results": [],
                    "errors": ["Wrapper returned invalid JSON"],
                }
            return parsed
        else:
            return {
                "status": "error",
                "results": [],
                "errors": ["Wrapper returned no output"],
            }

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
