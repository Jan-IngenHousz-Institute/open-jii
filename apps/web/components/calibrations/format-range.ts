interface Span {
  min: number;
  max: number;
  unit: string;
}

interface Range extends Span {
  name: string;
}

/** Joined so a line never breaks inside it: "0…" at one line's end and "32 V" on the next reads as two facts. */
export function formatSpan({ min, max, unit }: Span): string {
  return `${String(min)}\u2060…\u2060${String(max)}\u00a0${unit}`;
}

export function formatRange(range: Range): string {
  return `${range.name}\u00a0${formatSpan(range)}`;
}
