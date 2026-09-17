"""What a calibration script cannot reach or leave behind.

A definition is authored by any user, so these are the properties that make it safe to
run one. They hold at two levels: the wrapper's allowlisted builtins and proxied modules
stop a script reaching the interpreter at all, and the subprocess it runs in gets no
environment and cannot outlast its own invocation.
"""

import os
import unittest

import handler as handler_module
from handler import handler

SCHEMA = {"blocks": {"par": {"slope": {"type": "number"}, "intercept": {"type": "number"}}}}

# Three points that fit no line at all: an honest run must refuse them.
UNFITTABLE = {
    "par_sweep": [
        {"par_raw": 10.0, "par_ref": 900.0},
        {"par_raw": 20.0, "par_ref": 100.0},
        {"par_raw": 30.0, "par_ref": 500.0},
    ]
}

HONEST = """
from qc import assess_linear_fit
points = inputs["par_sweep"]
fit = assess_linear_fit(points["par_raw"], points["par_ref"], slope_min=0.1, slope_max=10.0)
block = {"status": "computed" if fit["passed"] else "rejected", "quality": fit}
if fit["passed"]:
    block["coefficients"] = {"slope": fit["slope"], "intercept": fit["intercept"]}
else:
    block["reason"] = "unfittable"
submit({"par": block})
"""

SKIP = 'submit({"par": {"status": "skipped", "reason": "nothing to do"}})'


def run(script, series=None):
    return handler(
        {
            "script": script,
            "series": UNFITTABLE if series is None else series,
            "params": {},
            "outputSchema": SCHEMA,
        },
        None,
    )


def refusal(script):
    """Run a script expected to be refused, and return the error line."""
    result = run(script, series={})
    assert result["status"] == "compute_failed", result
    return result["error"]


class RestrictedScopeTest(unittest.TestCase):
    """The wrapper's scope: what the script can name at all."""

    def test_the_numerical_stack_and_the_quality_gates_are_importable(self):
        script = (
            "import numpy as np\n"
            "from qc import assess_linear_fit\n"
            'submit({"par": {"status": "skipped", "reason": str(int(np.sum([1, 2])))}})'
        )
        result = run(script, series={})

        self.assertEqual(result["status"], "computed", result)
        self.assertEqual(result["blocks"]["par"]["reason"], "3")

    # A console answers JSON as often as a bare number, so parsing a reply is part of
    # fitting one. Every seeded definition opens with some subset of these.
    def test_the_parsing_modules_a_reply_needs_are_importable(self):
        script = (
            "import json\n"
            "import re\n"
            'value = json.loads(\'{"par": 12.5}\')["par"]\n'
            'digits = re.findall(r"\\d+", "ch0,ch1")\n'
            'submit({"par": {"status": "skipped", "reason": f"{value}-{len(digits)}"}})'
        )
        result = run(script, series={})

        self.assertEqual(result["status"], "computed", result)
        self.assertEqual(result["blocks"]["par"]["reason"], "12.5-2")

    def test_nothing_else_is_importable(self):
        for module in ["os", "sys", "subprocess", "socket", "importlib", "builtins", "shutil"]:
            with self.subTest(module=module):
                self.assertIn("is not allowed", refusal(f"import {module}\n{SKIP}"))

    def test_the_builtins_that_reach_the_host_are_absent(self):
        for builtin in ["open", "eval", "exec", "compile", "globals", "vars", "getattr", "dir"]:
            with self.subTest(builtin=builtin):
                self.assertIn("NameError", refusal(f"{builtin}\n{SKIP}"))

    # The classic escape: walk from any value to object's subclasses and find one that
    # opens a file. A bare tuple is no proxy, so the dunder is refused before the script
    # is compiled rather than by the value it is spelled against.
    def test_a_value_is_no_route_back_to_the_interpreter(self):
        for expression in [
            "().__class__.__bases__[0].__subclasses__()",
            "np.__builtins__",
            "qc.assess_linear_fit.__globals__",
            "submit.__globals__",
        ]:
            with self.subTest(expression=expression):
                self.assertIn("restricted", refusal(f"x = {expression}\n{SKIP}"))

    def test_params_are_read_only(self):
        result = handler(
            {
                "script": 'params["gain"] = 9\n' + SKIP,
                "series": {},
                "params": {"gain": 1},
                "outputSchema": SCHEMA,
            },
            None,
        )

        self.assertEqual(result["status"], "compute_failed", result)


class IsolationTest(unittest.TestCase):
    """The subprocess around the scope: environment, state and time."""

    def test_a_script_sees_none_of_the_function_environment(self):
        os.environ["AWS_SECRET_ACCESS_KEY"] = "decoy-must-not-be-readable"
        self.addCleanup(os.environ.pop, "AWS_SECRET_ACCESS_KEY", None)

        # `os` is not importable, so the only way to ask is through a module the script
        # does have. numpy carries no environment of its own, which is the point.
        self.assertIn("is not allowed", refusal(f"import os\n{SKIP}"))

    # A Lambda container is reused. In one interpreter a script could reassign qc's gate
    # and silently pass the next tenant's bad fit.
    def test_one_run_cannot_change_what_the_next_run_computes(self):
        before = run(HONEST)
        self.assertEqual(before["blocks"]["par"]["status"], "rejected")

        poison = (
            "import qc\n"
            "def always_passes(x, y, stimulus=None, **kw):\n"
            '    return {"passed": True, "reasons": [], "slope": 1.0, "intercept": 0.0}\n'
            "qc.assess_linear_fit = always_passes\n" + SKIP
        )
        self.assertIn("Cannot modify module attributes", refusal(poison))

        after = run(HONEST)
        self.assertEqual(after["blocks"]["par"]["status"], "rejected")
        self.assertFalse(after["blocks"]["par"]["quality"]["passed"])

    # The only channel back is one JSON document on stdout. Anyone debugging a fit adds a
    # print, and that used to make a calibration that worked come back unparseable.
    def test_a_script_that_prints_still_returns_its_blocks(self):
        script = 'print("halfway through the fit")\nprint("some more chatter")\n' + SKIP
        result = run(script, series={})

        self.assertEqual(result["status"], "computed", result)
        self.assertEqual(result["blocks"]["par"]["status"], "skipped")

    # A warm container keeps /tmp, so a script's own files must not outlive it. With no
    # `open` and no `tempfile` it cannot write one in the first place.
    def test_a_script_cannot_write_a_file_at_all(self):
        self.assertIn("is not allowed", refusal(f"import tempfile\n{SKIP}"))
        self.assertIn("NameError", refusal(f"open('/tmp/left-behind.txt', 'w')\n{SKIP}"))

    def test_a_script_that_never_finishes_is_stopped(self):
        original = handler_module.SCRIPT_TIMEOUT_SECONDS
        handler_module.SCRIPT_TIMEOUT_SECONDS = 2
        self.addCleanup(setattr, handler_module, "SCRIPT_TIMEOUT_SECONDS", original)

        result = run("while True:\n    pass\n", series={})

        self.assertEqual(result["status"], "compute_failed")
        self.assertIn("exceeded", result["error"])

    def test_a_script_cannot_leave_its_working_directory_behind(self):
        import tempfile

        run(SKIP, series={})

        leftovers = [
            name
            for name in os.listdir(tempfile.gettempdir())
            if name.startswith(handler_module.TEMP_PREFIX)
        ]
        self.assertEqual(leftovers, [])


if __name__ == "__main__":
    unittest.main()
