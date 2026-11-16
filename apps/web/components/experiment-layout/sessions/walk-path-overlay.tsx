interface WalkPathOverlayProps {
  points: readonly { x: number; y: number }[];
}

/**
 * The walk drawn through plot centers, with a halo so it reads over filled plots. The grid lifts
 * plot names and walk numbers above it, so the line never runs across them.
 */
export function WalkPathOverlay({ points }: WalkPathOverlayProps) {
  const polyline = points.map(({ x, y }) => `${x},${y}`).join(" ");

  return (
    <g>
      <polyline
        points={polyline}
        fill="none"
        className="stroke-background"
        strokeOpacity={0.9}
        strokeWidth={7}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={polyline}
        fill="none"
        className="stroke-primary"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}
