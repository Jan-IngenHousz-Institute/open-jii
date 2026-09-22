"use client";

import { useEffect, useState } from "react";

function format(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * How long the run has been going, counted from the moment this mounts.
 *
 * Mounting only while a phase runs is what keeps the count honest without the wizard holding
 * a start time it would then have to reset.
 */
export function CalibrationElapsed() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => setSeconds((previous) => previous + 1), 1_000);
    return () => clearInterval(tick);
  }, []);

  return (
    <span className="text-muted-foreground text-[11px] tabular-nums" aria-hidden>
      {format(seconds)}
    </span>
  );
}
