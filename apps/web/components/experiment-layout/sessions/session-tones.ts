/**
 * Class names per treatment and per measurer, from the platform chart palette. Measurers take hues
 * no treatment uses, so a share border never reads as a treatment.
 */
export interface TreatmentTone {
  pale: string;
  full: string;
  swatch: string;
}

export interface MeasurerTone {
  border: string;
  stroke: string;
  swatch: string;
}

const TREATMENT_TONES: readonly TreatmentTone[] = [
  { pale: "bg-chart-2/10", full: "bg-chart-2/35", swatch: "bg-chart-2/35" },
  { pale: "bg-chart-4/15", full: "bg-chart-4/55", swatch: "bg-chart-4/55" },
  { pale: "bg-node-question/10", full: "bg-node-question/40", swatch: "bg-node-question/40" },
];

const MEASURER_TONES: readonly MeasurerTone[] = [
  { border: "border-chart-1", stroke: "stroke-chart-1", swatch: "bg-chart-1" },
  { border: "border-node-analysis", stroke: "stroke-node-analysis", swatch: "bg-node-analysis" },
  { border: "border-node-branch", stroke: "stroke-node-branch", swatch: "bg-node-branch" },
];

const NO_TREATMENT: TreatmentTone = { pale: "bg-muted/40", full: "bg-muted", swatch: "bg-muted" };
const NO_MEASURER: MeasurerTone = {
  border: "border-border",
  stroke: "stroke-border",
  swatch: "bg-border",
};

export function treatmentTone(index: number): TreatmentTone {
  return TREATMENT_TONES[index % TREATMENT_TONES.length] ?? NO_TREATMENT;
}

export function measurerTone(index: number): MeasurerTone {
  return MEASURER_TONES[index % MEASURER_TONES.length] ?? NO_MEASURER;
}
