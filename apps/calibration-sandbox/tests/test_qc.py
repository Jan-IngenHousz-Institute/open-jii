import unittest

from qc import assess_linear_fit, assess_multilinear_fit, assess_origin_fit

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

    def test_non_finite_values_fail_closed(self):
        x = [float("inf"), *CLEAN_X[1:]]
        record = assess_origin_fit(x, CLEAN_Y, CLEAN_DRIVE, **BOUNDS)
        self.assertFalse(record["passed"])
        self.assertTrue(any("finite" in reason for reason in record["reasons"]))

    def test_non_monotonic_reference_readings_fail(self):
        y = [1.3, 600.0, 176.4, 642.7, 851.2, 1407.1]
        record = assess_origin_fit(CLEAN_X, y, CLEAN_DRIVE, **BOUNDS)
        self.assertFalse(record["passed"])
        self.assertTrue(any("reference readings" in reason for reason in record["reasons"]))

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

    def test_reference_monotonicity_is_checked_when_a_stimulus_is_given(self):
        # The device tracks the stimulus but the reference does not: a meter fault.
        record = assess_linear_fit([10.0, 20.0, 30.0], [10.0, 30.0, 5.0], [1, 2, 3], **LINEAR_BOUNDS)
        self.assertFalse(record["passed"])
        self.assertTrue(any("reference readings" in reason for reason in record["reasons"]))

    def test_non_finite_input_fails_closed(self):
        record = assess_linear_fit([1.0, 2.0, float("nan")], [1.0, 2.0, 3.0], **LINEAR_BOUNDS)
        self.assertFalse(record["passed"])
        self.assertIn("all calibration values must be finite", record["reasons"])

    def test_mismatched_lengths_raise(self):
        with self.assertRaises(ValueError):
            assess_linear_fit([1.0, 2.0, 3.0], [1.0, 2.0], **LINEAR_BOUNDS)


# A spectral bench: three channel counts per point, the reference PAR a known
# combination of them, so the fit has coefficients to recover.
SPECTRAL_COEFFICIENTS = [0.00786, 0.00344, 0.00285]
SPECTRAL_INTERCEPT = -0.34
SPECTRAL_ROWS = [
    [19.0, 53.0, 79.0],
    [11.0, 30.0, 40.0],
    [14.0, 41.0, 60.0],
    [25.0, 70.0, 96.0],
    [8.0, 22.0, 31.0],
    [30.0, 88.0, 120.0],
    [5.0, 15.0, 20.0],
]
SPECTRAL_Y = [
    sum(coefficient * value for coefficient, value in zip(SPECTRAL_COEFFICIENTS, row))
    + SPECTRAL_INTERCEPT
    for row in SPECTRAL_ROWS
]


class AssessMultilinearFitTest(unittest.TestCase):
    def test_channel_coefficients_are_recovered(self):
        record = assess_multilinear_fit(SPECTRAL_ROWS, SPECTRAL_Y)
        self.assertTrue(record["passed"], record["reasons"])
        self.assertEqual(record["fit"], "multilinear")
        for fitted, expected in zip(record["coefficients"], SPECTRAL_COEFFICIENTS):
            self.assertAlmostEqual(fitted, expected, places=6)
        self.assertAlmostEqual(record["intercept"], SPECTRAL_INTERCEPT, places=6)
        self.assertEqual(record["channels"], 3)
        self.assertEqual(record["points"], 7)
        self.assertEqual(record["rank"], 4)

    def test_exact_fit_is_refused(self):
        # Four points fit three channels plus an intercept exactly, so R-squared proves nothing.
        record = assess_multilinear_fit(SPECTRAL_ROWS[:4], SPECTRAL_Y[:4])
        self.assertFalse(record["passed"])
        self.assertIn("at least 5 calibration points are required for 3 channels", record["reasons"])

    def test_underdetermined_fit_is_refused_without_calling_the_channels_collinear(self):
        record = assess_multilinear_fit(SPECTRAL_ROWS[:3], SPECTRAL_Y[:3])
        self.assertFalse(record["passed"])
        self.assertIn("at least 5 calibration points are required for 3 channels", record["reasons"])
        self.assertFalse(any("collinear" in reason for reason in record["reasons"]))

    def test_collinear_channels_fail(self):
        rows = [[row[0], row[1], 2.0 * row[0]] for row in SPECTRAL_ROWS]
        record = assess_multilinear_fit(rows, SPECTRAL_Y)
        self.assertFalse(record["passed"])
        self.assertTrue(any("collinear" in reason for reason in record["reasons"]))

    def test_coefficient_bounds_gate(self):
        record = assess_multilinear_fit(
            SPECTRAL_ROWS, SPECTRAL_Y, coefficient_min=0.005, coefficient_max=1.0
        )
        self.assertFalse(record["passed"])
        self.assertTrue(any("channel coefficient" in reason for reason in record["reasons"]))

    def test_intercept_bounds_gate(self):
        record = assess_multilinear_fit(SPECTRAL_ROWS, SPECTRAL_Y, intercept_min=0.0)
        self.assertFalse(record["passed"])
        self.assertTrue(any("intercept must be" in reason for reason in record["reasons"]))

    def test_noisy_points_fail_r2(self):
        scrambled = [SPECTRAL_Y[index] for index in (3, 0, 5, 1, 6, 2, 4)]
        record = assess_multilinear_fit(SPECTRAL_ROWS, scrambled)
        self.assertFalse(record["passed"])
        self.assertTrue(any("R-squared" in reason for reason in record["reasons"]))

    def test_non_finite_input_fails_closed(self):
        rows = [[float("nan"), *SPECTRAL_ROWS[0][1:]], *SPECTRAL_ROWS[1:]]
        record = assess_multilinear_fit(rows, SPECTRAL_Y)
        self.assertFalse(record["passed"])
        self.assertIn("all calibration values must be finite", record["reasons"])
        self.assertFalse(any("collinear" in reason for reason in record["reasons"]))

    def test_ragged_rows_raise(self):
        with self.assertRaises(ValueError):
            assess_multilinear_fit([[1.0, 2.0], [1.0]], [1.0, 2.0])

    def test_mismatched_lengths_raise(self):
        with self.assertRaises(ValueError):
            assess_multilinear_fit(SPECTRAL_ROWS, SPECTRAL_Y[:-1])


if __name__ == "__main__":
    unittest.main()


class ResidualReportTest(unittest.TestCase):
    """The summary numbers say a fit is poor; the residuals say which reading made it so."""

    def test_clean_sweep_reports_one_residual_per_point(self):
        record = assess_origin_fit(CLEAN_X, CLEAN_Y, CLEAN_DRIVE, **BOUNDS)
        self.assertEqual(len(record["residuals"]), len(CLEAN_X))
        self.assertFalse(record["residuals_truncated"])
        self.assertLess(abs(record["worst_residual_fraction"]), 0.10)

    def test_one_bad_reading_is_named(self):
        spoiled = list(CLEAN_Y)
        spoiled[3] = spoiled[3] * 1.4
        record = assess_origin_fit(CLEAN_X, spoiled, CLEAN_DRIVE, **BOUNDS)
        self.assertEqual(record["worst_index"], 3)
        self.assertGreater(abs(record["worst_residual"]), 0.0)

    def test_linear_fit_names_the_reading_that_dragged_it(self):
        spoiled = list(CLEAN_Y)
        spoiled[1] = spoiled[1] + 300.0
        record = assess_linear_fit(
            CLEAN_X, spoiled, CLEAN_DRIVE, slope_min=0.05, slope_max=100.0
        )
        self.assertEqual(record["worst_index"], 1)

    # Enough points that the outlier cannot simply pull the fit onto itself: with only as
    # many points as parameters its leverage hides it, and the largest residual lands
    # somewhere innocent.
    def test_multilinear_fit_names_the_reading_that_dragged_it(self):
        rows = [
            [1.0, 0.0], [0.0, 1.0], [2.0, 1.0], [1.0, 2.0], [3.0, 1.0],
            [1.0, 3.0], [2.0, 2.0], [4.0, 1.0], [1.0, 4.0], [3.0, 3.0],
        ]
        y = [2.0 * a + 3.0 * b + 1.0 for a, b in rows]
        y[3] += 50.0
        record = assess_multilinear_fit(rows, y)
        self.assertEqual(record["worst_index"], 3)
        self.assertEqual(len(record["residuals"]), len(rows))

    def test_non_finite_residuals_report_none(self):
        record = assess_origin_fit(
            [float("inf"), *CLEAN_X[1:]], CLEAN_Y, CLEAN_DRIVE, **BOUNDS
        )
        self.assertEqual(record["residuals"], [])
        self.assertIsNone(record["worst_index"])


class WorstStimulusTest(unittest.TestCase):
    """The index is only meaningful inside the fitted set; the setpoint names the reading."""

    def test_origin_fit_names_the_setpoint(self):
        spoiled = list(CLEAN_Y)
        spoiled[3] = spoiled[3] * 1.4
        record = assess_origin_fit(CLEAN_X, spoiled, CLEAN_DRIVE, **BOUNDS)
        self.assertEqual(record["worst_stimulus"], CLEAN_DRIVE[3])

    def test_multilinear_fit_names_a_non_numeric_setpoint(self):
        rows = [
            [1.0, 0.0], [0.0, 1.0], [2.0, 1.0], [1.0, 2.0], [3.0, 1.0],
            [1.0, 3.0], [2.0, 2.0], [4.0, 1.0], [1.0, 4.0], [3.0, 3.0],
        ]
        y = [2.0 * a + 3.0 * b + 1.0 for a, b in rows]
        y[3] += 50.0
        filters = [f"filter e{index:03d}" for index in range(len(rows))]
        record = assess_multilinear_fit(rows, y, filters)
        self.assertEqual(record["worst_stimulus"], "filter e003")

    def test_setpoint_is_absent_when_the_caller_gave_none(self):
        record = assess_linear_fit(CLEAN_X, CLEAN_Y, slope_min=0.05, slope_max=100.0)
        self.assertIsNone(record["worst_stimulus"])


class ZeroSpanTest(unittest.TestCase):
    """A reference stuck on one value must fail the gate, not crash the run."""

    def test_origin_fit_survives_a_reference_that_never_moved(self):
        record = assess_origin_fit([1.0, 2.0, 3.0], [5.0, 5.0, 5.0], [0.0, 1.0, 2.0], **BOUNDS)
        self.assertFalse(record["passed"])
        self.assertTrue(any("non-zero" in reason for reason in record["reasons"]))

    def test_linear_fit_survives_a_reference_that_never_moved(self):
        record = assess_linear_fit(
            [1.0, 2.0, 3.0], [5.0, 5.0, 5.0], [0.0, 1.0, 2.0], slope_min=0.05, slope_max=100.0
        )
        self.assertFalse(record["passed"])
