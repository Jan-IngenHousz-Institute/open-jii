import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "functions" / "python"))

from handler import handler

PAR_SWEEP = [
    {"stimulus": 0.0, "par_raw": 1.1, "par_ref": 1.3},
    {"stimulus": 0.8, "par_raw": 148.2, "par_ref": 176.4},
    {"stimulus": 2.4, "par_raw": 431.7, "par_ref": 513.7},
    {"stimulus": 3.0, "par_raw": 540.1, "par_ref": 642.7},
    {"stimulus": 4.0, "par_raw": 715.3, "par_ref": 851.2},
    {"stimulus": 6.6, "par_raw": 1182.4, "par_ref": 1407.1},
]

AMBIT_SCHEMA = {
    "blocks": {
        "par": {"spec": {"type": "number", "min": 0.05, "max": 100.0}},
    }
}

AMBIT_SCRIPT = """
from qc import assess_origin_fit

sweep = inputs["par_sweep"]
fit = assess_origin_fit(
    sweep["par_raw"], sweep["par_ref"], sweep["stimulus"],
    coefficient_min=0.05, coefficient_max=100.0,
)
submit({"par": {"status": "computed", "coefficients": {"spec": fit["coefficient"]}, "quality": fit}})
"""


def event(script=AMBIT_SCRIPT, series=None, schema=None, params=None):
    return {
        "script": script,
        "series": {"par_sweep": PAR_SWEEP} if series is None else series,
        "params": params or {},
        "outputSchema": schema or AMBIT_SCHEMA,
    }


class HandlerTest(unittest.TestCase):
    def test_ambit_par_fit_computes(self):
        result = handler(event(), None)
        self.assertEqual(result["status"], "computed", result)
        self.assertAlmostEqual(result["blocks"]["par"]["coefficients"]["spec"], 1.19, places=2)
        self.assertTrue(result["blocks"]["par"]["quality"]["passed"])

    def test_numpy_integer_coefficient_is_accepted(self):
        script = (
            "import numpy as np\n"
            'submit({"par": {"status": "computed", "coefficients": {"spec": np.int64(2)}}})'
        )
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "computed", result)
        self.assertEqual(result["blocks"]["par"]["coefficients"]["spec"], 2)

    def test_non_finite_quality_values_serialize_as_null(self):
        script = (
            'submit({"par": {"status": "computed", "coefficients": {"spec": 1.0}, '
            '"quality": {"passed": True, "nrmse": float("inf")}}})'
        )
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "computed", result)
        self.assertIsNone(result["blocks"]["par"]["quality"]["nrmse"])
        json.dumps(result)

    def test_result_is_json_serializable(self):
        script = AMBIT_SCRIPT.replace(
            'fit["coefficient"]', 'sweep["par_ref"].mean() / sweep["par_raw"].mean()'
        )
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "computed", result)
        json.dumps(result)

    def test_pass_through_block_without_fit(self):
        script = 'submit({"baseline": {"status": "computed", "coefficients": {"channels": inputs["adpd_baseline"]["channels"][0]}}})'
        schema = {
            "blocks": {
                "baseline": {
                    "channels": {"type": "integer_array", "length": 6, "min": 0, "max": 16777215}
                }
            }
        }
        series = {"adpd_baseline": [{"channels": [1021, 987, 1103, 954, 1200, 1015]}]}
        result = handler(event(script=script, series=series, schema=schema), None)
        self.assertEqual(result["status"], "computed", result)
        self.assertEqual(len(result["blocks"]["baseline"]["coefficients"]["channels"]), 6)

    def test_params_are_injected(self):
        script = 'submit({"par": {"status": "computed", "coefficients": {"spec": params["gain"]}}})'
        result = handler(event(script=script, params={"gain": 1.5}), None)
        self.assertEqual(result["status"], "computed", result)
        self.assertEqual(result["blocks"]["par"]["coefficients"]["spec"], 1.5)

    def test_script_exception_is_compute_failed_with_traceback(self):
        result = handler(event(script="raise ValueError('bench went dark')"), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertIn("bench went dark", result["error"])
        self.assertTrue(any("bench went dark" in line for line in result["traceback"]))

    def test_missing_submit_is_compute_failed(self):
        result = handler(event(script="x = 1"), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertIn("without calling submit", result["error"])

    def test_double_submit_is_compute_failed(self):
        script = (
            'submit({"par": {"status": "computed", "coefficients": {"spec": 1.0}}})\n'
            'submit({"par": {"status": "computed", "coefficients": {"spec": 2.0}}})'
        )
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertIn("exactly once", result["error"])

    def test_unmentioned_block_is_recorded_as_skipped(self):
        # A bench without the instrument produces no series for that block; the
        # run stays usable and the record says the block was not attempted.
        result = handler(event(script="submit({})"), None)
        self.assertEqual(result["status"], "computed", result)
        self.assertEqual(result["blocks"]["par"]["status"], "skipped")
        self.assertIn("not produced", result["blocks"]["par"]["reason"])

    def test_partial_session_of_computed_rejected_and_skipped(self):
        # The Calibratron bench reality: one gain fitted, one attempted and
        # rejected on quality, one never attempted.
        script = (
            'submit({'
            '"par": {"status": "computed", "coefficients": {"spec": 1.19}}, '
            '"led": {"status": "rejected", "reason": "R-squared below 0.99", '
            '"quality": {"passed": False, "reasons": ["R-squared must be at least 0.99"]}}, '
            '"baseline": {"status": "skipped", "reason": "dark fixture not confirmed"}'
            '})'
        )
        schema = {
            "blocks": {
                "par": {"spec": {"type": "number", "min": 0.05, "max": 100.0}},
                "led": {"act": {"type": "number", "min": 0.01, "max": 1.0}},
                "baseline": {"channels": {"type": "integer_array", "length": 6}},
            }
        }
        result = handler(event(script=script, schema=schema), None)
        self.assertEqual(result["status"], "computed", result)
        self.assertEqual(result["blocks"]["par"]["status"], "computed")
        self.assertEqual(result["blocks"]["led"]["status"], "rejected")
        self.assertEqual(result["blocks"]["baseline"]["status"], "skipped")

    def test_rejected_block_needs_no_coefficients(self):
        script = 'submit({"par": {"status": "rejected", "reason": "fit failed"}})'
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "computed", result)

    def test_block_without_a_status_fails_validation(self):
        script = 'submit({"par": {"coefficients": {"spec": 1.0}}})'
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("status" in reason for reason in result["reasons"]))

    def test_skipped_block_carrying_coefficients_fails_validation(self):
        script = 'submit({"par": {"status": "skipped", "coefficients": {"spec": 1.0}}})'
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("still carries coefficients" in r for r in result["reasons"]))

    def test_undeclared_block_fails_validation(self):
        script = (
            'submit({"par": {"status": "computed", "coefficients": {"spec": 1.0}}, '
            '"extra": {"status": "computed", "coefficients": {"x": 1.0}}})'
        )
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("not declared" in reason for reason in result["reasons"]))

    def test_out_of_bounds_coefficient_fails_validation(self):
        script = 'submit({"par": {"status": "computed", "coefficients": {"spec": 250.0}}})'
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("maximum" in reason for reason in result["reasons"]))

    def test_non_finite_coefficient_fails_validation(self):
        script = 'submit({"par": {"status": "computed", "coefficients": {"spec": float("nan")}}})'
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("finite" in reason for reason in result["reasons"]))

    def test_wrong_integer_array_length_fails_validation(self):
        script = 'submit({"baseline": {"status": "computed", "coefficients": {"channels": [1, 2, 3]}}})'
        schema = {
            "blocks": {"baseline": {"channels": {"type": "integer_array", "length": 6, "min": 0}}}
        }
        result = handler(event(script=script, schema=schema, series={}), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("exactly 6" in reason for reason in result["reasons"]))

    def test_failed_qc_gates_fail_the_run(self):
        script = (
            'submit({"par": {"status": "computed", "coefficients": {"spec": 1.0}, '
            '"quality": {"passed": False, "reasons": ["R-squared must be at least 0.99"]}}})'
        )
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("mark it rejected" in reason for reason in result["reasons"]))

    def test_malformed_event_is_error(self):
        self.assertEqual(handler({}, None)["status"], "error")
        self.assertEqual(handler({"script": "submit({})"}, None)["status"], "error")
        self.assertEqual(handler("not an object", None)["status"], "error")

    def test_handler_never_raises(self):
        result = handler({"script": AMBIT_SCRIPT, "series": {"par_sweep": "not rows"}}, None)
        self.assertEqual(result["status"], "error")


if __name__ == "__main__":
    unittest.main()
