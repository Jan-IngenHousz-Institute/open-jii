import json
import unittest

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


# The simplest procedure there is: three light levels, the device read raw and
# a handheld reference typed in, fitted with a slope and an intercept.
MINIPAR_POINTS = [
    {"stimulus": "bright", "par_raw": 420.0, "par_ref": 402.12},
    {"stimulus": "medium", "par_raw": 150.0, "par_ref": 142.92},
    {"stimulus": "dim", "par_raw": 8.33, "par_ref": 6.92},
]

MINIPAR_SCHEMA = {
    "blocks": {
        "par": {
            "slope": {"type": "number", "min": 0.1, "max": 10.0},
            "intercept": {"type": "number", "min": -100.0, "max": 100.0},
        }
    }
}

MINIPAR_SCRIPT = """
from qc import assess_linear_fit

points = inputs["par_sweep"]
fit = assess_linear_fit(
    points["par_raw"], points["par_ref"],
    slope_min=0.1, slope_max=10.0, intercept_min=-100.0, intercept_max=100.0,
)
block = {"status": "computed" if fit["passed"] else "rejected", "quality": fit}
if fit["passed"]:
    block["coefficients"] = {"slope": fit["slope"], "intercept": fit["intercept"]}
else:
    block["reason"] = "; ".join(fit["reasons"])
submit({"par": block})
"""


# The spectral bench: the console prints the raw spectrum as "<model>,ch0,...", the
# reference PAR is typed in, and the channel coefficients go to the device while
# the intercept stays on the run.
SPECTRAL_COEFFICIENTS = [0.00786, 0.00344, 0.00285]
SPECTRAL_INTERCEPT = -0.34
SPECTRAL_COUNTS = [
    ("no filter", [19, 53, 79]),
    ("filter e002", [11, 30, 40]),
    ("filter e003", [14, 41, 60]),
    ("filter e004", [25, 70, 96]),
    ("filter e007", [8, 22, 31]),
    ("filter e008", [30, 88, 120]),
    ("the dark cap", [5, 15, 20]),
]
SPECTRAL_POINTS = [
    {
        "stimulus": label,
        "spec_raw": "AS7341," + ",".join(str(count) for count in counts),
        "par_ref": sum(c * v for c, v in zip(SPECTRAL_COEFFICIENTS, counts)) + SPECTRAL_INTERCEPT,
    }
    for label, counts in SPECTRAL_COUNTS
]

SPECTRAL_SCHEMA = {
    "blocks": {"spec": {"channel_coefficients": {"type": "number_array", "length": 3}}}
}

SPECTRAL_SCRIPT = """
import math

from qc import assess_multilinear_fit

CHANNELS = 10


def channel_counts(line):
    parts = [part.strip() for part in str(line).split(",") if part.strip()]
    if parts and not parts[0][0].isdigit():
        parts = parts[1:]
    return [float(part) for part in parts[:CHANNELS]]


points = inputs["spec_sweep"]
fit = assess_multilinear_fit(
    [channel_counts(line) for line in points["spec_raw"]],
    points["par_ref"],
    intercept_min=-100.0,
    intercept_max=100.0,
)

fitted = all(math.isfinite(value) for value in fit["coefficients"]) and math.isfinite(
    fit["intercept"]
)
if fitted:
    block = {
        "status": "computed",
        "coefficients": {"channel_coefficients": fit["coefficients"]},
        "fit": {"intercept": fit["intercept"]},
        "quality": fit,
    }
else:
    block = {"status": "rejected", "reason": "; ".join(fit["reasons"]), "quality": fit}
submit({"spec": block})
"""


def minipar_event(points=MINIPAR_POINTS):
    return {
        "script": MINIPAR_SCRIPT,
        "series": {"par_sweep": points},
        "params": {},
        "outputSchema": MINIPAR_SCHEMA,
    }


def event(script=AMBIT_SCRIPT, series=None, schema=None, params=None):
    return {
        "script": script,
        "series": {"par_sweep": PAR_SWEEP} if series is None else series,
        "params": params or {},
        "outputSchema": schema or AMBIT_SCHEMA,
    }


class HandlerTest(unittest.TestCase):
    def test_minipar_manual_fit_computes(self):
        result = handler(minipar_event(), None)
        self.assertEqual(result["status"], "computed", result)
        block = result["blocks"]["par"]
        self.assertAlmostEqual(block["coefficients"]["slope"], 0.96, places=2)
        self.assertAlmostEqual(block["coefficients"]["intercept"], -1.08, places=1)
        self.assertTrue(block["quality"]["passed"])

    def test_minipar_manual_fit_with_too_few_points_is_rejected(self):
        # Two points fit a line exactly, so the gate refuses. The sandbox reports
        # that per block; whether the run as a whole fails is the backend's call.
        result = handler(minipar_event(points=MINIPAR_POINTS[:2]), None)
        self.assertEqual(result["status"], "computed", result)
        block = result["blocks"]["par"]
        self.assertEqual(block["status"], "rejected")
        self.assertNotIn("coefficients", block)
        self.assertIn("at least three calibration points", block["reason"])

    def test_spectral_fit_writes_channel_coefficients_and_keeps_the_intercept(self):
        result = handler(
            event(script=SPECTRAL_SCRIPT, series={"spec_sweep": SPECTRAL_POINTS}, schema=SPECTRAL_SCHEMA),
            None,
        )
        self.assertEqual(result["status"], "computed", result)
        block = result["blocks"]["spec"]
        coefficients = block["coefficients"]["channel_coefficients"]
        self.assertEqual(len(coefficients), 3)
        for fitted, expected in zip(coefficients, SPECTRAL_COEFFICIENTS):
            self.assertAlmostEqual(fitted, expected, places=6)
        self.assertAlmostEqual(block["fit"]["intercept"], SPECTRAL_INTERCEPT, places=6)
        self.assertTrue(block["quality"]["passed"], block["quality"]["reasons"])

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

    # A notebook habit: ending a script with exit() must read as the script's doing.
    def test_script_that_exits_is_compute_failed(self):
        result = handler(event(script="raise SystemExit(0)"), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertIn("SystemExit", result["error"])

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
        # A real bench session: one gain fitted, one attempted and rejected on
        # quality, one never attempted.
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

    # The API caps a block's free text; a block that passed here and failed there
    # reached the record as an unrecognised payload, with the explanation lost.
    def test_reason_longer_than_the_contract_allows_fails_validation(self):
        script = f'submit({{"par": {{"status": "skipped", "reason": "{"x" * 2001}"}}}})'
        result = handler(event(script), None)

        self.assertEqual(result["status"], "compute_failed", result)
        self.assertIn("reason must be a string of at most 2000", "; ".join(result["reasons"]))

    def test_record_larger_than_the_contract_allows_fails_validation(self):
        script = (
            'submit({"par": {"status": "computed", "coefficients": {"spec": 1.0},'
            ' "quality": {"note": "x" * 20000}}})'
        )
        result = handler(event(script), None)

        self.assertEqual(result["status"], "compute_failed", result)
        self.assertIn("quality must serialise to at most", "; ".join(result["reasons"]))

    # A status that is not even a string is a script fault, not a handler crash.
    def test_status_that_is_not_a_string_fails_validation(self):
        result = handler(event('submit({"par": {"status": []}})'), None)

        self.assertEqual(result["status"], "compute_failed", result)
        self.assertIn("needs a status", "; ".join(result["reasons"]))

    def test_a_cyclic_submission_is_the_scripts_fault(self):
        script = (
            "record = {}\n"
            'record["self"] = record\n'
            'submit({"par": {"status": "skipped", "reason": "loop", "quality": record}})'
        )
        result = handler(event(script), None)

        self.assertEqual(result["status"], "compute_failed", result)
        self.assertIn("cannot be serialised", result["error"])

    def test_failed_qc_gates_are_advisory_and_travel_with_the_block(self):
        script = (
            'submit({"par": {"status": "computed", "coefficients": {"spec": 1.0}, '
            '"quality": {"passed": False, "reasons": ["R-squared must be at least 0.99"]}}})'
        )
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "computed", result)
        quality = result["blocks"]["par"]["quality"]
        self.assertFalse(quality["passed"])
        self.assertEqual(quality["reasons"], ["R-squared must be at least 0.99"])

    def test_series_that_is_not_an_object_is_error(self):
        result = handler(event(series="rows"), None)
        self.assertEqual(result["status"], "error")
        self.assertIn("'series'", result["error"])

    def test_params_that_are_not_an_object_is_error(self):
        result = handler(event(params=[1, 2]), None)
        self.assertEqual(result["status"], "error")
        self.assertIn("'params'", result["error"])

    def test_series_entry_that_is_not_rows_is_error(self):
        result = handler(event(series={"par_sweep": {"par_raw": 1.0}}), None)
        self.assertEqual(result["status"], "error")
        self.assertIn("array of rows", result["error"])

    def test_submit_of_a_non_dict_is_compute_failed(self):
        result = handler(event(script="submit([1, 2])"), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertIn("keyed by block name", result["error"])

    def test_block_that_is_not_a_dict_fails_validation(self):
        result = handler(event(script='submit({"par": 1.19})'), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("must be a dict" in reason for reason in result["reasons"]))

    def test_block_with_unknown_key_fails_validation(self):
        script = 'submit({"par": {"status": "computed", "coefficients": {"spec": 1.0}, "note": "x"}})'
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("unknown key 'note'" in reason for reason in result["reasons"]))

    def test_block_quality_that_is_not_a_dict_fails_validation(self):
        script = 'submit({"par": {"status": "computed", "coefficients": {"spec": 1.0}, "quality": "ok"}})'
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("quality must be a dict" in reason for reason in result["reasons"]))

    def test_computed_block_without_coefficients_fails_validation(self):
        result = handler(event(script='submit({"par": {"status": "computed"}})'), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("carries no coefficients" in reason for reason in result["reasons"]))

    def test_coefficients_that_are_not_a_dict_fail_validation(self):
        script = 'submit({"par": {"status": "computed", "coefficients": [1.0]}})'
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("coefficients dict" in reason for reason in result["reasons"]))

    def test_missing_required_coefficient_fails_validation(self):
        script = 'submit({"par": {"status": "computed", "coefficients": {}}})'
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("required but missing" in reason for reason in result["reasons"]))

    def test_undeclared_coefficient_fails_validation(self):
        script = 'submit({"par": {"status": "computed", "coefficients": {"spec": 1.0, "stray": 2.0}}})'
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("'par.stray' is not declared" in reason for reason in result["reasons"]))

    def test_unknown_spec_type_fails_validation(self):
        schema = {"blocks": {"par": {"spec": {"type": "matrix"}}}}
        script = 'submit({"par": {"status": "computed", "coefficients": {"spec": 1.0}}})'
        result = handler(event(script=script, schema=schema), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("unknown spec type" in reason for reason in result["reasons"]))

    def test_non_numeric_coefficient_fails_validation(self):
        script = 'submit({"par": {"status": "computed", "coefficients": {"spec": "1.0"}}})'
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("must be a finite number" in reason for reason in result["reasons"]))

    def test_below_minimum_coefficient_fails_validation(self):
        script = 'submit({"par": {"status": "computed", "coefficients": {"spec": 0.001}}})'
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("minimum" in reason for reason in result["reasons"]))

    def test_integer_array_given_a_scalar_fails_validation(self):
        script = 'submit({"baseline": {"status": "computed", "coefficients": {"channels": 1021}}})'
        schema = {"blocks": {"baseline": {"channels": {"type": "integer_array", "length": 6}}}}
        result = handler(event(script=script, schema=schema, series={}), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("integer array" in reason for reason in result["reasons"]))

    def test_each_integer_array_entry_is_checked(self):
        script = (
            'submit({"baseline": {"status": "computed", '
            '"coefficients": {"channels": [1.5, -1, 16777216, 4, 5, 6]}}})'
        )
        schema = {
            "blocks": {
                "baseline": {
                    "channels": {"type": "integer_array", "length": 6, "min": 0, "max": 16777215}
                }
            }
        }
        result = handler(event(script=script, schema=schema, series={}), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("[0]' must be an integer" in reason for reason in result["reasons"]))
        self.assertTrue(any("[1]' is below" in reason for reason in result["reasons"]))
        self.assertTrue(any("[2]' is above" in reason for reason in result["reasons"]))

    def test_number_array_accepts_fractional_signed_entries(self):
        script = (
            "import numpy as np\n"
            'submit({"spec": {"status": "computed", '
            '"coefficients": {"channel_coefficients": np.array([0.00785574, -0.000739113, 0.0])}}})'
        )
        schema = {
            "blocks": {
                "spec": {"channel_coefficients": {"type": "number_array", "length": 3, "min": -1, "max": 1}}
            }
        }
        result = handler(event(script=script, schema=schema, series={}), None)
        self.assertEqual(result["status"], "computed", result)
        self.assertEqual(
            result["blocks"]["spec"]["coefficients"]["channel_coefficients"],
            [0.00785574, -0.000739113, 0.0],
        )

    def test_number_array_given_a_scalar_fails_validation(self):
        script = 'submit({"spec": {"status": "computed", "coefficients": {"channel_coefficients": 0.5}}})'
        schema = {"blocks": {"spec": {"channel_coefficients": {"type": "number_array", "length": 3}}}}
        result = handler(event(script=script, schema=schema, series={}), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("must be a number array" in reason for reason in result["reasons"]))

    def test_each_number_array_entry_is_checked(self):
        script = (
            'submit({"spec": {"status": "computed", '
            '"coefficients": {"channel_coefficients": [float("nan"), -2.0, 1.5]}}})'
        )
        schema = {
            "blocks": {
                "spec": {"channel_coefficients": {"type": "number_array", "length": 3, "min": -1, "max": 1}}
            }
        }
        result = handler(event(script=script, schema=schema, series={}), None)
        self.assertEqual(result["status"], "compute_failed")
        self.assertTrue(any("[0]' must be a finite number" in reason for reason in result["reasons"]))
        self.assertTrue(any("[1]' is below" in reason for reason in result["reasons"]))
        self.assertTrue(any("[2]' is above" in reason for reason in result["reasons"]))

    # A script's fit record naturally holds numpy arrays and scalars; the record
    # a reader gets back is plain JSON regardless.
    def test_numpy_values_in_the_fit_record_serialize_as_plain_json(self):
        script = (
            "import numpy as np\n"
            'submit({"par": {"status": "computed", "coefficients": {"spec": 1.0}, '
            '"fit": {"points": np.array([1.0, 2.0]), "n": np.int64(3), "tags": {"a"}}}})'
        )
        result = handler(event(script=script), None)
        self.assertEqual(result["status"], "computed", result)
        fit = json.loads(json.dumps(result))["blocks"]["par"]["fit"]
        self.assertEqual(fit["points"], [1.0, 2.0])
        self.assertEqual(fit["n"], 3)
        self.assertIsInstance(fit["tags"], str)

    def test_malformed_event_is_error(self):
        self.assertEqual(handler({}, None)["status"], "error")
        self.assertEqual(handler({"script": "submit({})"}, None)["status"], "error")
        self.assertEqual(handler("not an object", None)["status"], "error")

    def test_handler_never_raises(self):
        result = handler({"script": AMBIT_SCRIPT, "series": {"par_sweep": "not rows"}}, None)
        self.assertEqual(result["status"], "error")


if __name__ == "__main__":
    unittest.main()
