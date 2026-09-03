"use client";

interface FleetSparklineProps {
  /** One total per axis bucket, in axis order. */
  values: number[];
}

const WIDTH = 100;
const HEIGHT = 28;
const PAD = 2;

/**
 * The hero tile's pulse line: total volume per bucket as a filled area with
 * the newest point emphasised. Decorative summary only, so it carries no axes
 * and is hidden from the accessibility tree; the number above it is the fact.
 */
export function FleetSparkline({ values }: FleetSparklineProps) {
  if (values.length < 2 || values.every((value) => value === 0)) {
    return null;
  }

  const max = Math.max(...values);
  const step = (WIDTH - 2 * PAD) / (values.length - 1);
  const points = values.map((value, index) => ({
    x: PAD + index * step,
    y: HEIGHT - PAD - (value / max) * (HEIGHT - 2 * PAD),
  }));

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`);
  const area = [
    ...line,
    `L ${points[points.length - 1].x} ${HEIGHT - PAD}`,
    `L ${PAD} ${HEIGHT - PAD}`,
    "Z",
  ];
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="h-7 w-full"
      aria-hidden
    >
      <path d={area.join(" ")} fill="var(--primary)" opacity={0.12} />
      <path
        d={line.join(" ")}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last.x} cy={last.y} r={2} fill="var(--primary)" />
    </svg>
  );
}
