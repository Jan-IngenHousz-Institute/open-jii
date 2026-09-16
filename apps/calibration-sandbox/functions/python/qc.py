"""Numerical quality gates for calibration fits, shared so two scripts fitting the
same curve cannot disagree about what passes.
"""

from __future__ import annotations

import math

import numpy as np

MIN_R2 = 0.99
MAX_NRMSE = 0.05
MAX_FULL_SCALE_RESIDUAL = 0.10
MAX_INTERCEPT_FRACTION = 0.05
MAX_MONOTONIC_REVERSAL = 0.02
# A multi-channel fit can satisfy every residual gate on channels that move together, and
# then answer nonsense for any spectrum outside the ones it was shown. The condition number
# is what shows it. A real bench fit of this model sits around 650; a fit with one degree of
# freedom left sits in the thousands.
MAX_CONDITION_NUMBER = 1000.0
# A bench sweep is a handful of points. The cap only stops a pathological run putting a
# megabyte of residuals into a record that is read back with every run.
MAX_REPORTED_RESIDUALS = 200


def _residual_report(residual, y_span, labels=None):
    """Per-point residuals, in the order the caller passed its points.

    A reviewer can see that a fit is poor from the summary numbers, but not which reading
    made it poor. The index is only meaningful within what the caller fitted, which may be
    a subset of a stored series, so the worst point is also named by its setpoint where
    the caller supplied one.
    """
    # A caller may hand this a DataFrame column rather than a list. The truth of a pandas
    # Series is an error rather than a length, and indexing one goes by label, not position.
    setpoints = None if labels is None else list(labels)
    usable = bool(residual) and all(math.isfinite(value) for value in residual)
    truncated = len(residual) > MAX_REPORTED_RESIDUALS
    worst = (
        max(range(len(residual)), key=lambda index: abs(residual[index])) if usable else None
    )
    return {
        "residuals": residual if usable and not truncated else [],
        "residuals_truncated": usable and truncated,
        "worst_index": worst,
        "worst_residual": residual[worst] if worst is not None else math.nan,
        "worst_residual_fraction": (
            abs(residual[worst]) / y_span if worst is not None and y_span > 0 else math.inf
        ),
        "worst_stimulus": (
            setpoints[worst]
            if worst is not None and setpoints is not None and worst < len(setpoints)
            else None
        ),
    }


def assess_origin_fit(x_values, y_values, stimulus, *, coefficient_min, coefficient_max):
    """Fit ``y = coefficient * x`` and return a fail-closed QC record.

    The stimulus only orders the sweep for the monotonicity test.
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
        **_residual_report(residual, y_span, drive),
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

    The stimulus, when given, orders the points for the monotonicity test.
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
        **_residual_report(residual, y_span, drive),
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


def assess_multilinear_fit(
    rows,
    y_values,
    stimulus=None,
    *,
    coefficient_min=-math.inf,
    coefficient_max=math.inf,
    intercept_min=-math.inf,
    intercept_max=math.inf,
):
    """Fit ``y = sum(coefficient[i] * x[i]) + intercept`` over channel vectors and
    return a fail-closed QC record.

    One row per calibration point, every row the same channel vector length.
    """
    x = [[float(value) for value in row] for row in rows]
    y = [float(value) for value in y_values]
    reasons = []

    if len(x) != len(y):
        raise ValueError("calibration rows and reference values must be equal length")
    channels = len(x[0]) if x else 0
    if channels == 0 or any(len(row) != channels for row in x):
        raise ValueError("every calibration row must hold the same non-zero number of channels")

    parameters = channels + 1
    # With no degrees of freedom the fit is exact by construction and R-squared proves nothing.
    if len(x) <= parameters:
        reasons.append(
            f"at least {parameters + 1} calibration points are required for {channels} channels"
        )

    finite = all(math.isfinite(value) for row in x for value in row) and all(
        math.isfinite(value) for value in y
    )
    if not finite:
        reasons.append("all calibration values must be finite")

    y_span = max(y) - min(y) if finite and y else 0.0
    if y_span <= 0:
        reasons.append("reference values must span a non-zero range")

    if finite:
        design = np.hstack([np.array(x), np.ones((len(x), 1))])
        solution, _, rank, singular = np.linalg.lstsq(design, np.array(y), rcond=None)
        coefficients = [float(value) for value in solution[:-1]]
        intercept = float(solution[-1])
        rank = int(rank)
        condition_number = (
            float(singular[0] / singular[-1]) if singular.size and singular[-1] > 0 else math.inf
        )
        residual = [float(value) for value in np.array(y) - design @ solution]
    else:
        coefficients = [math.nan] * channels
        intercept = math.nan
        rank = 0
        condition_number = math.inf
        residual = []

    # Rank only says something once the points could have determined every parameter.
    if finite and len(x) > parameters and rank < parameters:
        reasons.append("channel readings are collinear, so the coefficients are not unique")
    # Like rank, this says nothing until the points could have determined every parameter,
    # and a non-finite input is already reported as such.
    if finite and len(x) > parameters and condition_number > MAX_CONDITION_NUMBER:
        reasons.append(
            f"channel readings are too close to collinear to determine the coefficients "
            f"(condition number must be at most {MAX_CONDITION_NUMBER})"
        )

    ss_res = sum(value * value for value in residual) if residual else math.inf
    y_mean = sum(y) / len(y) if y else 0.0
    ss_tot = sum((value - y_mean) ** 2 for value in y) if finite else 0.0
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 and math.isfinite(ss_res) else math.nan
    rmse = math.sqrt(ss_res / len(y)) if y and math.isfinite(ss_res) else math.inf
    nrmse = rmse / y_span if y_span > 0 and math.isfinite(rmse) else math.inf
    max_residual_fraction = (
        max(abs(value) for value in residual) / y_span if residual and y_span > 0 else math.inf
    )

    within_bounds = all(
        math.isfinite(value) and coefficient_min <= value <= coefficient_max
        for value in coefficients
    )
    if not within_bounds:
        reasons.append(
            "every channel coefficient must be finite and within "
            f"[{coefficient_min}, {coefficient_max}]"
        )
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
        "fit": "multilinear",
        "coefficients": coefficients,
        "intercept": intercept,
        "r2": r2,
        "rmse": rmse,
        "nrmse": nrmse,
        "max_residual_fraction": max_residual_fraction,
        "condition_number": condition_number,
        "rank": rank,
        "points": len(x),
        "channels": channels,
        **_residual_report(residual, y_span, stimulus),
        "thresholds": {
            "min_r2": MIN_R2,
            "max_nrmse": MAX_NRMSE,
            "max_full_scale_residual": MAX_FULL_SCALE_RESIDUAL,
            "max_condition_number": MAX_CONDITION_NUMBER,
            "coefficient_min": coefficient_min,
            "coefficient_max": coefficient_max,
            "intercept_min": intercept_min,
            "intercept_max": intercept_max,
        },
    }
