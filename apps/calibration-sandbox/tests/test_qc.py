import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "functions" / "python"))

from qc import assess_linear_fit, assess_origin_fit

# A clean bench sweep: y = 1.19 * x with negligible noise.
CLEAN_X = [1.1, 148.2, 431.7, 540.1, 715.3, 1182.4]
CLEAN_Y = [1.3, 176.4, 513.7, 642.7, 851.2, 1407.1]
CLEAN_DRIVE = [0.0, 0.8, 2.4, 3.0, 4.0, 6.6]
BOUNDS = {"coefficient_min": 0.05, "coefficient_max": 100.0}


class AssessOriginFitTest(unittest.TestCase):
    def test_clean_sweep_passes(self):
        record = assess_origin_fit(CLEAN_X, CLEAN_Y, CLEAN_DRIVE, **BOUNDS)
        self.assertTrue(record["passed"], record["reasons"])
        self.assertAlmostEqual(record["coefficient"], 1.19, places=2)
        self.assertGreaterEqual(record["r2"], 0.99)

    def test_record_carries_thresholds(self):
        record = assess_origin_fit(CLEAN_X, CLEAN_Y, CLEAN_DRIVE, **BOUNDS)
        self.assertEqual(record["fit"], "through_origin")
        self.assertEqual(record["thresholds"]["coefficient_min"], 0.05)

    def test_noisy_sweep_fails_r2(self):
        noisy_y = [900.0, 100.0, 600.0, 300.0, 1200.0, 700.0]
        record = assess_origin_fit(CLEAN_X, noisy_y, CLEAN_DRIVE, **BOUNDS)
        self.assertFalse(record["passed"])

    def test_non_monotonic_device_readings_fail(self):
        x = [1.0, 500.0, 100.0, 540.0, 715.0, 1182.0]
        record = assess_origin_fit(x, CLEAN_Y, CLEAN_DRIVE, **BOUNDS)
        self.assertFalse(record["passed"])
        self.assertTrue(any("monotonic" in reason for reason in record["reasons"]))

    def test_negative_values_fail(self):
        x = [-1.0, *CLEAN_X[1:]]
        record = assess_origin_fit(x, CLEAN_Y, CLEAN_DRIVE, **BOUNDS)
        self.assertFalse(record["passed"])

    def test_coefficient_outside_bounds_fails(self):
        record = assess_origin_fit(
            CLEAN_X, CLEAN_Y, CLEAN_DRIVE, coefficient_min=5.0, coefficient_max=100.0
        )
        self.assertFalse(record["passed"])

    def test_fewer_than_three_points_fail(self):
        record = assess_origin_fit([1.0, 2.0], [1.1, 2.2], [0, 1], **BOUNDS)
        self.assertFalse(record["passed"])

    def test_zero_span_fails(self):
        record = assess_origin_fit([5.0] * 4, [5.0] * 4, [0, 1, 2, 3], **BOUNDS)
        self.assertFalse(record["passed"])

    def test_mismatched_lengths_raise(self):
        with self.assertRaises(ValueError):
            assess_origin_fit([1.0], [1.0, 2.0], [0], **BOUNDS)


if __name__ == "__main__":
    unittest.main()


# The simplest procedure: three light levels read by hand, y = 0.96 * x - 1.08.
LINEAR_X = [8.33, 150.0, 420.0]
LINEAR_Y = [6.92, 142.92, 402.12]
LINEAR_BOUNDS = {"slope_min": 0.1, "slope_max": 10.0}


class AssessLinearFitTest(unittest.TestCase):
    def test_three_manual_points_pass(self):
        record = assess_linear_fit(LINEAR_X, LINEAR_Y, **LINEAR_BOUNDS)
        self.assertTrue(record["passed"], record["reasons"])
        self.assertAlmostEqual(record["slope"], 0.96, places=2)
        self.assertAlmostEqual(record["intercept"], -1.08, places=1)
        self.assertEqual(record["fit"], "linear")

    def test_stimulus_is_optional(self):
        # A manual procedure's light levels need not be ordered or even known.
        without = assess_linear_fit(LINEAR_X, LINEAR_Y, **LINEAR_BOUNDS)
        with_drive = assess_linear_fit(LINEAR_X, LINEAR_Y, [1, 2, 3], **LINEAR_BOUNDS)
        self.assertEqual(without["slope"], with_drive["slope"])
        self.assertTrue(with_drive["passed"])

    def test_two_points_are_refused(self):
        # Two points always fit a line exactly, so R-squared proves nothing.
        record = assess_linear_fit(LINEAR_X[:2], LINEAR_Y[:2], **LINEAR_BOUNDS)
        self.assertFalse(record["passed"])
        self.assertIn("at least three calibration points are required", record["reasons"])

    def test_intercept_bounds_gate(self):
        record = assess_linear_fit(
            LINEAR_X, LINEAR_Y, **LINEAR_BOUNDS, intercept_min=0.0, intercept_max=100.0
        )
        self.assertFalse(record["passed"])
        self.assertTrue(any("intercept must be" in reason for reason in record["reasons"]))

    def test_noisy_points_fail_r2(self):
        record = assess_linear_fit([8.33, 150.0, 420.0], [300.0, 10.0, 200.0], **LINEAR_BOUNDS)
        self.assertFalse(record["passed"])
        self.assertTrue(any("R-squared" in reason for reason in record["reasons"]))

    def test_monotonicity_is_checked_when_a_stimulus_is_given(self):
        # Reference rising while the device falls with the stimulus is a rig fault.
        record = assess_linear_fit([10.0, 20.0, 5.0], [10.0, 20.0, 30.0], [1, 2, 3], **LINEAR_BOUNDS)
        self.assertFalse(record["passed"])
        self.assertTrue(any("not monotonic" in reason for reason in record["reasons"]))

    def test_non_finite_input_fails_closed(self):
        record = assess_linear_fit([1.0, 2.0, float("nan")], [1.0, 2.0, 3.0], **LINEAR_BOUNDS)
        self.assertFalse(record["passed"])
        self.assertIn("all calibration values must be finite", record["reasons"])

    def test_mismatched_lengths_raise(self):
        with self.assertRaises(ValueError):
            assess_linear_fit([1.0, 2.0, 3.0], [1.0, 2.0], **LINEAR_BOUNDS)
