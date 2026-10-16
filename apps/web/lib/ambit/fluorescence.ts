import type { AmbitSeries } from "./timeseries";

type FluorescenceResult =
  | { status: "available"; series: AmbitSeries; filledReferences: number }
  | { status: "missing" | "unaligned" | "invalid" };

export function deriveFluorescence(series: AmbitSeries[]): FluorescenceResult {
  const signal = series.find((item) => item.name === "fluo_630_signal");
  const reference = series.find((item) => item.name === "fluo_630_ref");
  if (!signal || !reference) return { status: "missing" };
  if (signal.unit !== "count" || reference.unit !== "count") return { status: "invalid" };
  if (
    signal.time.length !== reference.time.length ||
    signal.time.some((time, i) => Math.abs(time - reference.time[i]) > 1e-9)
  ) {
    return { status: "unaligned" };
  }
  if (reference.values.some((value) => value < 0)) return { status: "invalid" };
  const measured = reference.values.filter((value) => value > 0);
  if (measured.length === 0) return { status: "invalid" };
  const meanReference = measured.reduce((sum, value) => sum + value / measured.length, 0);
  // The deployed ambyte-trace macro fills zero references during actinic pulses
  // with the trace's mean measured reference, keeping the whole curve in one unit.
  const values = signal.values.map((value, i) => value / (reference.values[i] || meanReference));
  if (values.some((value) => !Number.isFinite(value))) return { status: "invalid" };
  return {
    status: "available",
    filledReferences: reference.values.length - measured.length,
    series: {
      name: "fluorescence",
      unit: "ratio",
      time: signal.time,
      values,
      estimatedTime: signal.estimatedTime || reference.estimatedTime,
    },
  };
}
