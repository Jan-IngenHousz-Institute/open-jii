const isOn = (value: string | undefined) => value === "1" || value === "true";

// Thresholds fail a single-file run, so coverage is on for CI and on request, not by default.
export const coverageEnabled = isOn(process.env.CI) || isOn(process.env.COVERAGE);
