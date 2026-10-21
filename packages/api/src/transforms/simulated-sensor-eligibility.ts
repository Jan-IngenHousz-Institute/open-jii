// M1 supplies organizationType on experiment get/list; this is the sole integration seam.
export function simulatedSensorsEnabled(experiment: unknown): boolean {
  return (
    experiment !== null &&
    typeof experiment === "object" &&
    "organizationType" in experiment &&
    experiment.organizationType === "demo"
  );
}
