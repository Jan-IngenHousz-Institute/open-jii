"use client";

import { useMyScopedMetrics } from "@/hooks/metrics/useMyScopedMetrics/useMyScopedMetrics";
import { usePublicMetrics } from "@/hooks/metrics/usePublicMetrics/usePublicMetrics";

import { useTranslation } from "@repo/i18n";

interface PlatformStatChipsProps {
  locale: string;
}

interface Chip {
  key: string;
  value: number;
}

/** Windowed workspace numbers under the dashboard title; not vanity counters. */
export function PlatformStatChips({ locale }: PlatformStatChipsProps) {
  const { t } = useTranslation("publicMetrics");
  const { data: publicMetrics } = usePublicMetrics();
  const { data: mine } = useMyScopedMetrics();

  const liveness = publicMetrics?.liveness ?? null;
  const community = publicMetrics?.community ?? null;
  if (liveness === null || community === null) {
    return null;
  }

  const format = (value: number) => new Intl.NumberFormat(locale).format(value);

  const chips: Chip[] = [
    { key: "month", value: community.measurements30d },
    { key: "day", value: liveness.measurements24h },
    ...(mine ? [{ key: "mine", value: mine.scoped.measurements30d }] : []),
    { key: "experiments", value: community.activeExperiments30d },
  ];

  const renderChip = (chip: Chip) => (
    <div
      key={chip.key}
      className="border-primary bg-card flex min-w-28 flex-col rounded-lg border border-l-4 px-4 py-2"
    >
      <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
        {t(`dashboard.chips.${chip.key}.label`)}
      </span>
      <span className="text-foreground text-lg font-bold tabular-nums">{format(chip.value)}</span>
      <span className="text-muted-foreground text-[10px]">
        {t(`dashboard.chips.${chip.key}.unit`)}
      </span>
    </div>
  );

  return <div className="flex flex-wrap gap-2">{chips.map(renderChip)}</div>;
}
