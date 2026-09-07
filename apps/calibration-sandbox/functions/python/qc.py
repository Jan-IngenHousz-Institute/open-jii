"""Numerical quality gates for calibration fits.

One set of gates for every definition, so two scripts that fit the same kind
of curve cannot disagree about what passes.
"""

from __future__ import annotations

import math

MIN_R2 = 0.99
MAX_NRMSE = 0.05
MAX_FULL_SCALE_RESIDUAL = 0.10
MAX_INTERCEPT_FRACTION = 0.05
MAX_MONOTONIC_REVERSAL = 0.02


def assess_origin_fit(x_values, y_values, stimulus, *, coefficient_min, coefficient_max):
    """Fit ``y = coefficient * x`` and return a fail-closed QC record.

    The stimulus is used only to put the sweep in physical order for the
    monotonicity test. The coefficient used by the device is deliberately fit
    through the origin; a free-intercept fit is retained as a diagnostic gate.
    """
    x = [float(value) for value in x_values]
    y = [float(value) for value in y_values]
    drive = [float(value) for value in stimulus]
    reasons = []

    if not (len(x) == len(y) == len(drive)):
        raise ValueError("calibration vectors must be one-dimensional and equal length")
    if len(x) < 3:
        reasons.append("at least three calibration points are required")
    if not all(math.isfinite(value) for value in x + y + drive):
        reasons.append("all calibration values must be finite")
    if any(value < 0 for value in x + y + drive):
        reasons.append("calibration values must be non-negative")

    finite = all(math.isfinite(value) for value in x + y + drive)
    x_span = max(x) - min(x) if finite and x else 0.0
    y_span = max(y) - min(y) if finite and y else 0.0
    if x_span <= 0 or y_span <= 0:
        reasons.append("calibration sweep must span a non-zero input and reference range")

    if finite and len(x) >= 2:
        order = sorted(range(len(drive)), key=drive.__getitem__)
        ordered_x = [x[index] for index in order]
        ordered_y = [y[index] for index in order]
        x_tolerance = MAX_MONOTONIC_REVERSAL * x_span
        y_tolerance = MAX_MONOTONIC_REVERSAL * y_span
        if any(right - left < -x_tolerance for left, right in zip(ordered_x, ordered_x[1:])):
            reasons.append("device readings are not monotonic with the applied stimulus")
        if any(right - left < -y_tolerance for left, right in zip(ordered_y, ordered_y[1:])):
            reasons.append("reference readings are not monotonic with the applied stimulus")

    denominator = sum(value * value for value in x) if finite else 0.0
    coefficient = sum(a * b for a, b in zip(x, y)) / denominator if denominator > 0 else math.nan
    prediction = [coefficient * value for value in x]
    residual = [actual - predicted for actual, predicted in zip(y, prediction)]
    ss_res = (
        sum(value * value for value in residual)
        if all(math.isfinite(value) for value in residual)
        else math.inf
    )
    y_mean = sum(y) / len(y) if y else 0.0
    ss_tot = sum((value - y_mean) ** 2 for value in y) if finite else 0.0
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 and math.isfinite(ss_res) else math.nan
    nrmse = (
        math.sqrt(ss_res / len(y)) / y_span
        if len(y) and y_span > 0 and math.isfinite(ss_res)
        else math.inf
    )
    max_residual_fraction = (
        max(abs(value) for value in residual) / y_span
        if residual and y_span > 0 and all(math.isfinite(value) for value in residual)
        else math.inf
    )

    if finite and len(x) >= 2 and x_span > 0:
        x_mean = sum(x) / len(x)
        covariance = sum((a - x_mean) * (b - y_mean) for a, b in zip(x, y))
        variance = sum((value - x_mean) ** 2 for value in x)
        free_slope = covariance / variance
        free_intercept = y_mean - free_slope * x_mean
        intercept_fraction = abs(free_intercept) / y_span
    else:
        free_slope = free_intercept = math.nan
        intercept_fraction = math.inf

    if not math.isfinite(coefficient) or not coefficient_min <= coefficient <= coefficient_max:
        reasons.append(
            f"coefficient must be finite and within [{coefficient_min}, {coefficient_max}]"
        )
    if not math.isfinite(r2) or r2 < MIN_R2:
        reasons.append(f"R-squared must be at least {MIN_R2}")
    if not math.isfinite(nrmse) or nrmse > MAX_NRMSE:
        reasons.append(f"normalized RMSE must be at most {MAX_NRMSE}")
    if not math.isfinite(max_residual_fraction) or max_residual_fraction > MAX_FULL_SCALE_RESIDUAL:
        reasons.append(f"maximum residual must be at most {MAX_FULL_SCALE_RESIDUAL} of full scale")
    if not math.isfinite(intercept_fraction) or intercept_fraction > MAX_INTERCEPT_FRACTION:
        reasons.append(f"free-fit intercept must be at most {MAX_INTERCEPT_FRACTION} of full scale")

    return {
        "passed": not reasons,
        "reasons": reasons,
        "fit": "through_origin",
        "coefficient": coefficient,
        "r2": r2,
        "nrmse": nrmse,
        "max_residual_fraction": max_residual_fraction,
        "free_slope": free_slope,
        "free_intercept": free_intercept,
        "free_intercept_fraction": intercept_fraction,
        "thresholds": {
            "coefficient_min": coefficient_min,
            "coefficient_max": coefficient_max,
            "min_r2": MIN_R2,
            "max_nrmse": MAX_NRMSE,
            "max_full_scale_residual": MAX_FULL_SCALE_RESIDUAL,
            "max_intercept_fraction": MAX_INTERCEPT_FRACTION,
            "max_monotonic_reversal": MAX_MONOTONIC_REVERSAL,
        },
    }


def assess_linear_fit(
    x_values,
    y_values,
    stimulus=None,
    *,
    slope_min,
    slope_max,
    intercept_min=-math.inf,
    intercept_max=math.inf,
):
    """Fit ``y = slope * x + intercept`` and return a fail-closed QC record.

    For devices that store an intercept alongside the gain. The stimulus, when
    given, puts the points in physical order for the monotonicity test; a
    manual procedure whose light levels are unordered may omit it.
    """
    x = [float(value) for value in x_values]
    y = [float(value) for value in y_values]
    drive = None if stimulus is None else [float(value) for value in stimulus]
    reasons = []

    if len(x) != len(y) or (drive is not None and len(drive) != len(x)):
        raise ValueError("calibration vectors must be one-dimensional and equal length")
    if len(x) < 3:
        reasons.append("at least three calibration points are required")

    finite = all(math.isfinite(value) for value in x + y + (drive or []))
    if not finite:
        reasons.append("all calibration values must be finite")

    x_span = max(x) - min(x) if finite and x else 0.0
    y_span = max(y) - min(y) if finite and y else 0.0
    if x_span <= 0 or y_span <= 0:
        reasons.append("calibration points must span a non-zero input and reference range")

    if drive is not None and finite and len(x) >= 2:
        order = sorted(range(len(drive)), key=drive.__getitem__)
        ordered_x = [x[index] for index in order]
        ordered_y = [y[index] for index in order]
        x_tolerance = MAX_MONOTONIC_REVERSAL * x_span
        y_tolerance = MAX_MONOTONIC_REVERSAL * y_span
        if any(right - left < -x_tolerance for left, right in zip(ordered_x, ordered_x[1:])):
            reasons.append("device readings are not monotonic with the applied stimulus")
        if any(right - left < -y_tolerance for left, right in zip(ordered_y, ordered_y[1:])):
            reasons.append("reference readings are not monotonic with the applied stimulus")

    if finite and len(x) >= 2 and x_span > 0:
        x_mean = sum(x) / len(x)
        y_mean = sum(y) / len(y)
        variance = sum((value - x_mean) ** 2 for value in x)
        slope = sum((a - x_mean) * (b - y_mean) for a, b in zip(x, y)) / variance
        intercept = y_mean - slope * x_mean
    else:
        slope = intercept = math.nan
        y_mean = sum(y) / len(y) if y else 0.0

    prediction = [slope * value + intercept for value in x]
    residual = [actual - predicted for actual, predicted in zip(y, prediction)]
    residual_finite = all(math.isfinite(value) for value in residual)
    ss_res = sum(value * value for value in residual) if residual_finite else math.inf
    ss_tot = sum((value - y_mean) ** 2 for value in y) if finite else 0.0
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 and math.isfinite(ss_res) else math.nan
    nrmse = (
        math.sqrt(ss_res / len(y)) / y_span
        if len(y) and y_span > 0 and math.isfinite(ss_res)
        else math.inf
    )
    max_residual_fraction = (
        max(abs(value) for value in residual) / y_span
        if residual and y_span > 0 and residual_finite
        else math.inf
    )

    if not math.isfinite(slope) or not slope_min <= slope <= slope_max:
        reasons.append(f"slope must be finite and within [{slope_min}, {slope_max}]")
    if not math.isfinite(intercept) or not intercept_min <= intercept <= intercept_max:
        reasons.append(f"intercept must be finite and within [{intercept_min}, {intercept_max}]")
    if not math.isfinite(r2) or r2 < MIN_R2:
        reasons.append(f"R-squared must be at least {MIN_R2}")
    if not math.isfinite(nrmse) or nrmse > MAX_NRMSE:
        reasons.append(f"normalized RMSE must be at most {MAX_NRMSE}")
    if not math.isfinite(max_residual_fraction) or max_residual_fraction > MAX_FULL_SCALE_RESIDUAL:
        reasons.append(f"maximum residual must be at most {MAX_FULL_SCALE_RESIDUAL} of full scale")

    return {
        "passed": not reasons,
        "reasons": reasons,
        "fit": "linear",
        "slope": slope,
        "intercept": intercept,
        "r2": r2,
        "nrmse": nrmse,
        "max_residual_fraction": max_residual_fraction,
        "points": len(x),
        "thresholds": {
            "min_r2": MIN_R2,
            "max_nrmse": MAX_NRMSE,
            "max_full_scale_residual": MAX_FULL_SCALE_RESIDUAL,
            "slope_min": slope_min,
            "slope_max": slope_max,
            "intercept_min": intercept_min,
            "intercept_max": intercept_max,
        },
    }
