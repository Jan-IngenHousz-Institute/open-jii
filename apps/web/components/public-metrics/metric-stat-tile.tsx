"use client";

import { useCountUp } from "./use-count-up";

interface MetricStatTileProps {
  label: string;
  value: number;
  locale: string;
  active: boolean;
}

export function MetricStatTile({ label, value, locale, active }: MetricStatTileProps) {
  const displayed = useCountUp(value, active);
  const formatted = new Intl.NumberFormat(locale).format(displayed);

  return (
    <div className="bg-card flex flex-col items-center gap-1 rounded-lg border px-6 py-5 text-center">
      <span className="text-primary text-3xl font-bold tabular-nums md:text-4xl">{formatted}</span>
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
  );
}
