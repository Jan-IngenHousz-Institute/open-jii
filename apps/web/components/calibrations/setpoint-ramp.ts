/** The most points a sweep may hold, as the procedure contract counts them. */
const MAX_POINTS = 64;

/** Trailing noise from dividing a range, which no bench setting ever means. */
function trim(value: number): number {
  return Number(value.toPrecision(10));
}

export function setpointRamp(from: number, to: number, points: number): number[] {
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return [];
  }
  const count = Math.floor(points);
  if (count < 2 || count > MAX_POINTS) {
    return [];
  }

  const step = (to - from) / (count - 1);
  return Array.from({ length: count }, (_, index) => trim(from + step * index));
}
