"""What a calibration script cannot reach or leave behind.

A definition is authored by any user, so these are the properties that make it
safe to run one: it gets no environment, it cannot outlast its own invocation,
and it cannot change what the next run sees.
"""

import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "functions" / "python"))

import handler as handler_module  # noqa: E402
from handler import handler  # noqa: E402

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


class IsolationTest(unittest.TestCase):
    def test_a_script_sees_none_of_the_function_environment(self):
        os.environ["AWS_SECRET_ACCESS_KEY"] = "decoy-must-not-be-readable"
        self.addCleanup(os.environ.pop, "AWS_SECRET_ACCESS_KEY", None)

        script = (
            "import os\n"
            'leaked = [k for k in os.environ if "AWS" in k]\n'
            'submit({"par": {"status": "rejected", "reason": ",".join(leaked) or "nothing"}})'
        )
        result = run(script, series={})

        self.assertEqual(result["status"], "computed", result)
        self.assertEqual(result["blocks"]["par"]["reason"], "nothing")

    # A Lambda container is reused. In one interpreter a script could reassign
    # qc's gate and silently pass the next tenant's bad fit.
    def test_one_run_cannot_change_what_the_next_run_computes(self):
        before = run(HONEST)
        self.assertEqual(before["blocks"]["par"]["status"], "rejected")

        poison = (
            "import qc\n"
            "_real = qc.assess_linear_fit\n"
            "def always_passes(x, y, stimulus=None, **kw):\n"
            "    record = _real(x, y, stimulus, **kw)\n"
            '    record["passed"] = True\n'
            '    record["reasons"] = []\n'
            "    return record\n"
            "qc.assess_linear_fit = always_passes\n"
            'submit({"par": {"status": "skipped", "reason": "nothing to do"}})'
        )
        run(poison)

        after = run(HONEST)
        self.assertEqual(after["blocks"]["par"]["status"], "rejected")
        self.assertFalse(after["blocks"]["par"]["quality"]["passed"])

    # The only channel back is one JSON document on stdout. Anyone debugging a fit adds a
    # print, and that used to make a calibration that worked come back unparseable.
    def test_a_script_that_prints_still_returns_its_blocks(self):
        script = (
            'print("halfway through the fit")\n'
            'print("some more chatter")\n'
            'submit({"par": {"status": "skipped", "reason": "nothing to do"}})'
        )
        result = run(script, series={})

        self.assertEqual(result["status"], "computed", result)
        self.assertEqual(result["blocks"]["par"]["status"], "skipped")

    # A warm container keeps /tmp. A script's own temporary files must not outlive it.
    def test_one_run_cannot_leave_a_temp_file_for_the_next(self):
        writer = (
            "import tempfile, os\n"
            "path = os.path.join(tempfile.gettempdir(), 'left-behind.txt')\n"
            "open(path, 'w').write('from the previous tenant')\n"
            'submit({"par": {"status": "skipped", "reason": path}})'
        )
        first = run(writer, series={})
        self.assertEqual(first["status"], "computed", first)
        left = first["blocks"]["par"]["reason"]

        reader = (
            "import os\n"
            f"found = os.path.exists({left!r})\n"
            'submit({"par": {"status": "rejected", "reason": "found" if found else "gone"}})'
        )
        second = run(reader, series={})

        self.assertEqual(second["status"], "computed", second)
        self.assertEqual(second["blocks"]["par"]["reason"], "gone")

    def test_a_script_that_never_finishes_is_stopped(self):
        original = handler_module.SCRIPT_TIMEOUT_SECONDS
        handler_module.SCRIPT_TIMEOUT_SECONDS = 2
        self.addCleanup(setattr, handler_module, "SCRIPT_TIMEOUT_SECONDS", original)

        result = run("while True:\n    pass\n", series={})

        self.assertEqual(result["status"], "compute_failed")
        self.assertIn("exceeded", result["error"])

    def test_a_script_cannot_leave_its_working_directory_behind(self):
        import tempfile

        run('submit({"par": {"status": "skipped", "reason": "x"}})', series={})

        leftovers = [
            name
            for name in os.listdir(tempfile.gettempdir())
            if name.startswith(handler_module.TEMP_PREFIX)
        ]
        self.assertEqual(leftovers, [])


if __name__ == "__main__":
    unittest.main()
