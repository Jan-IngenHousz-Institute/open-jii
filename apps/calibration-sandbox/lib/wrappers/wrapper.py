"""Runs one calibration script, and nothing else, in its own process.

The handler never executes a script itself. It writes the run event here and starts
this module as a subprocess with a stripped environment, so a script cannot read the
function's credentials and cannot leave state behind for the next tenant's run in a
warm container. The only channel back is one JSON document on stdout.

Process isolation is the outer wall. Inside it the script runs against an allowlisted
`__builtins__` and proxied modules, the same restrictions the macro sandbox's wrapper
imposes: no `open`, no `eval`, no `getattr`, and no dunder route from a value back to
the interpreter. Imports are allowlisted rather than removed, because a calibration
script is ported from a notebook and reads as one.
"""

import ast
import contextlib
import io
import json
import math
import os
import signal
import sys
import traceback
import types

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "../src/helpers"))

try:
    import numpy as np
    import pandas as pd
    import scipy
    import qc
except ImportError as exc:
    print(json.dumps({"outcome": "runner_failed", "error": f"Import failed: {exc}"}))
    sys.exit(0)

TRACEBACK_TAIL_LINES = 20

# Under the handler's subprocess timeout, so an overrunning script reports its own
# line number instead of being killed from outside with nothing to show.
SCRIPT_ALARM_SECONDS = 25

# What a script prints is kept for its traceback and nothing else, so a loop that prints
# on every row is cut here rather than buffered until the function runs out of memory.
PRINT_CAP_CHARS = 64 * 1024

# A device console answers JSON as often as it answers a bare number, so a script that
# parses a reply needs it. The modules themselves can read files and open sockets; the
# audit hook below is what stops that, not the import list.
ALLOWED_IMPORTS = {"qc", "numpy", "pandas", "scipy", "math", "statistics", "json", "re"}

HELPERS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../src/helpers")

# Where a script may read from: the interpreter, whose lazily imported modules open files
# under it, and the shared gates. Nothing else on the host, and nowhere at all to write.
READABLE_ROOTS = tuple(
    os.path.realpath(root) for root in (sys.prefix, sys.base_prefix, HELPERS_DIR)
)
WRITE_MODE_CHARS = set("wax+")
WRITE_FLAGS = os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND

# Audit events a fit never raises and an escape always does: sockets and the clients
# built on them, other processes, and anything that changes the filesystem.
DENIED_EVENT_PREFIXES = (
    "socket.",
    "urllib.",
    "http.client.",
    "ftplib.",
    "smtplib.",
    "poplib.",
    "imaplib.",
    "nntplib.",
    "telnetlib.",
    "subprocess.",
    "os.system",
    "os.exec",
    "os.posix_spawn",
    "os.spawn",
    "os.fork",
    "os.kill",
    "os.remove",
    "os.rename",
    "os.rmdir",
    "os.mkdir",
    "os.chmod",
    "os.chown",
    "os.link",
    "os.symlink",
    "os.truncate",
    "os.unlink",
    "os.utime",
    "shutil.",
    "tempfile.",
    "pty.",
    "ctypes.",
    "webbrowser.",
    "sqlite3.",
)


class CappedBuffer(io.StringIO):
    """Keeps the first PRINT_CAP_CHARS a script prints and drops the rest unbuffered."""

    def write(self, text):
        room = PRINT_CAP_CHARS - self.tell()
        if room > 0:
            super().write(text[:room])
        return len(text)


def _open_is_allowed(args):
    path, mode, flags = args[0], args[1], args[2]
    # A descriptor already open came from a read this hook allowed.
    if isinstance(path, int):
        return True
    if not isinstance(path, (str, bytes, os.PathLike)):
        return False

    wants_write = (
        bool(set(mode) & WRITE_MODE_CHARS)
        if isinstance(mode, str)
        else bool((flags or 0) & WRITE_FLAGS)
    )
    if wants_write:
        return False

    real = os.path.realpath(os.fsdecode(path))
    return any(real == root or real.startswith(root + os.sep) for root in READABLE_ROOTS)


def _deny_escapes(event, args):
    """Refuse, at the interpreter, what the allowlisted libraries could otherwise reach.

    pandas reads any path and any URL, numpy saves to any path, and a subprocess with a
    stripped environment still shares the function's user with the runtime that holds its
    credentials. Process isolation is not a boundary against that; this is the layer that
    turns each of those into an error at the call.
    """
    if event == "open":
        if _open_is_allowed(args):
            return
        raise PermissionError(f"a calibration script may not open {args[0]!r}")
    if event.startswith(DENIED_EVENT_PREFIXES):
        raise PermissionError(f"a calibration script may not use {event}")


class SafeModule:
    """Blocks introspection on wrapped modules."""

    BLOCKED_ATTRS = {
        "__globals__",
        "__code__",
        "__builtins__",
        "__dict__",
        "__class__",
        "__bases__",
        "__subclasses__",
        "__init__",
        "__loader__",
        "__spec__",
        "__package__",
    }

    def __init__(self, module):
        object.__setattr__(self, "_module", module)

    def __getattribute__(self, name):
        if name in object.__getattribute__(self, "BLOCKED_ATTRS"):
            raise AttributeError(f"access to '{name}' is restricted")

        if name.startswith("__") and name.endswith("__") and name not in {"__name__", "__doc__"}:
            raise AttributeError(f"access to '{name}' is restricted")

        attr = getattr(object.__getattribute__(self, "_module"), name)

        if isinstance(attr, types.ModuleType):
            return SafeModule(attr)
        if isinstance(attr, (types.FunctionType, types.MethodType, types.BuiltinFunctionType)):
            return SafeCallable(attr)
        if isinstance(attr, type):
            return SafeClass(attr)
        return attr

    def __setattr__(self, name, value):
        raise AttributeError("Cannot modify module attributes")

    def __repr__(self):
        module = object.__getattribute__(self, "_module")
        return f"<SafeModule({getattr(module, '__name__', 'unknown')})>"


class SafeCallable:
    """Blocks __globals__ and other introspection on wrapped callables."""

    BLOCKED_ATTRS = {
        "__globals__",
        "__code__",
        "__builtins__",
        "__dict__",
        "__closure__",
        "__class__",
        "__func__",
        "__self__",
    }

    def __init__(self, func):
        object.__setattr__(self, "_func", func)

    def __call__(self, *args, **kwargs):
        return object.__getattribute__(self, "_func")(*args, **kwargs)

    def __getattribute__(self, name):
        if name == "_func":
            return object.__getattribute__(self, name)

        if name in object.__getattribute__(self, "BLOCKED_ATTRS"):
            raise AttributeError(f"access to '{name}' is restricted")

        if name.startswith("__") and name.endswith("__"):
            if name not in {"__name__", "__doc__", "__call__"}:
                raise AttributeError(f"access to '{name}' is restricted")

        return getattr(object.__getattribute__(self, "_func"), name)

    def __repr__(self):
        func = object.__getattribute__(self, "_func")
        return f"<SafeCallable({getattr(func, '__name__', 'unknown')})>"


class SafeClass:
    """Blocks __init__.__globals__ and similar on wrapped classes."""

    BLOCKED_ATTRS = {
        "__globals__",
        "__code__",
        "__builtins__",
        "__dict__",
        "__bases__",
        "__subclasses__",
        "__init__",
        "__class__",
    }

    def __init__(self, cls):
        object.__setattr__(self, "_cls", cls)

    def __call__(self, *args, **kwargs):
        return object.__getattribute__(self, "_cls")(*args, **kwargs)

    def __getattribute__(self, name):
        if name == "_cls":
            return object.__getattribute__(self, name)

        if name in object.__getattribute__(self, "BLOCKED_ATTRS"):
            raise AttributeError(f"access to '{name}' is restricted")

        if name.startswith("__") and name.endswith("__"):
            if name not in {"__name__", "__doc__", "__call__"}:
                raise AttributeError(f"access to '{name}' is restricted")

        return getattr(object.__getattribute__(self, "_cls"), name)

    def __repr__(self):
        cls = object.__getattribute__(self, "_cls")
        return f"<SafeClass({getattr(cls, '__name__', 'unknown')})>"


def _freeze(value):
    """Params are read-only to the script: dicts become proxies and lists tuples."""
    if isinstance(value, dict):
        return types.MappingProxyType({key: _freeze(entry) for key, entry in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(entry) for entry in value)
    return value


def _guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
    """The numerical stack and the shared quality gates, and nothing else."""
    if level != 0 or name.split(".")[0] not in ALLOWED_IMPORTS:
        raise ImportError(f"import of '{name}' is not allowed in a calibration script")
    return SafeModule(__import__(name, globals, locals, fromlist, level))


SAFE_BUILTINS = {
    "abs": abs,
    "all": all,
    "any": any,
    "bool": bool,
    "dict": dict,
    "divmod": divmod,
    "enumerate": enumerate,
    "filter": filter,
    "float": float,
    "int": int,
    "isinstance": isinstance,
    "iter": iter,
    "len": len,
    "list": list,
    "map": map,
    "max": max,
    "min": min,
    "next": next,
    "pow": pow,
    "range": range,
    "reversed": reversed,
    "round": round,
    "set": set,
    "sorted": sorted,
    "str": str,
    "sum": sum,
    "tuple": tuple,
    "zip": zip,
    # Captured, not emitted: the handler reads one JSON document off stdout, and what a
    # script printed is folded into the trace when it fails.
    "print": print,
    "__import__": _guarded_import,
    # A script raises and catches these while deciding a block is not computable.
    "Exception": Exception,
    "ValueError": ValueError,
    "TypeError": TypeError,
    "KeyError": KeyError,
    "IndexError": IndexError,
    "AttributeError": AttributeError,
    "ZeroDivisionError": ZeroDivisionError,
    "ArithmeticError": ArithmeticError,
    "RuntimeError": RuntimeError,
    "StopIteration": StopIteration,
    "AssertionError": AssertionError,
    "NameError": NameError,
}


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


def _reject_dunder_access(source):
    """Refuse a script that names a dunder, before it is compiled.

    The proxies guard what comes out of a module, but a bare value does not pass through
    them: `().__class__.__bases__[0].__subclasses__()` walks from an empty tuple to every
    loaded class and out through one of their `__globals__`. Every such route has to
    spell a dunder, and none of them appears in a fit.
    """
    tree = ast.parse(source, "<calibration-script>", "exec")
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            raise AttributeError(f"access to '{node.attr}' is restricted")
        if isinstance(node, ast.Name) and node.id.startswith("__"):
            raise AttributeError(f"access to '{node.id}' is restricted")
    return tree


def _raise_timeout(signum, frame):
    raise TimeoutError(f"Script exceeded {SCRIPT_ALARM_SECONDS}s")


def _run(event):
    inputs = {name: pd.DataFrame(rows) for name, rows in (event.get("series") or {}).items()}
    submissions = []

    def submit(blocks):
        submissions.append(blocks)

    scope = {
        "__builtins__": SAFE_BUILTINS,
        "inputs": inputs,
        "params": _freeze(event.get("params") or {}),
        "submit": submit,
        "np": SafeModule(np),
        "pd": SafeModule(pd),
        "scipy": SafeModule(scipy),
        "qc": SafeModule(qc),
    }

    # The only channel back to the handler is one JSON document on stdout, so anything the
    # script prints has to be kept off it. A print() while debugging a fit would otherwise
    # turn a calibration that worked into an unparseable reply.
    printed = CappedBuffer()
    try:
        signal.signal(signal.SIGALRM, _raise_timeout)
        signal.alarm(SCRIPT_ALARM_SECONDS)
        tree = _reject_dunder_access(event["script"])
        # Installed after the script is compiled and never removed: from here on this
        # process may only compute and print its one line.
        sys.addaudithook(_deny_escapes)
        with contextlib.redirect_stdout(printed):
            exec(compile(tree, "<calibration-script>", "exec"), scope)
        signal.alarm(0)
    # BaseException: a script that calls exit() is a script fault, not a sandbox failure.
    except BaseException as exc:
        signal.alarm(0)
        return {
            "outcome": "script_failed",
            "error": "".join(traceback.format_exception_only(type(exc), exc)).strip(),
            "trace": (
                "".join(traceback.format_exc()).splitlines()[-TRACEBACK_TAIL_LINES:]
                + printed.getvalue().splitlines()[-TRACEBACK_TAIL_LINES:]
            ),
        }

    if len(submissions) == 0:
        return {"outcome": "no_submit"}
    if len(submissions) > 1:
        return {"outcome": "many_submits"}
    if not isinstance(submissions[0], dict):
        return {"outcome": "not_a_dict"}

    # A submission that cannot be serialised (a cycle, most likely) is the script's
    # fault and is reported as one, not as the sandbox failing.
    try:
        blocks = _jsonable(submissions[0])
    except Exception as exc:
        return {
            "outcome": "script_failed",
            "error": f"{type(exc).__name__}: submit() was given a value that cannot be serialised",
            "trace": printed.getvalue().splitlines()[-TRACEBACK_TAIL_LINES:],
        }
    return {"outcome": "submitted", "blocks": blocks}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"outcome": "runner_failed", "error": "Usage: wrapper.py <event.json>"}))
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
