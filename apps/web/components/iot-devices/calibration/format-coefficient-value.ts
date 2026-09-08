export function formatCoefficientValue(value: number | number[]): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => formatCoefficientValue(entry)).join(", ")}]`;
  }
  return Number(value.toPrecision(6)).toString();
}
