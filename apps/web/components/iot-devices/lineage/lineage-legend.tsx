"use client";

import { useTranslation } from "@repo/i18n";

const SWATCH: Record<string, React.CSSProperties> = {
  input: { borderTop: "2px solid var(--border)" },
  active: { borderTop: "2px solid var(--primary)" },
  silent: { borderTop: "2px dashed var(--border)" },
  unbound: { borderTop: "2px dashed var(--status-stale-foreground)" },
  unattributed: { borderTop: "2px dashed var(--muted-foreground)" },
  processing: { borderTop: "2px dotted var(--node-instruction)" },
};

/** Edge-state key for the lineage canvas. */
export function LineageLegend() {
  const { t } = useTranslation("iot");

  return (
    <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {Object.entries(SWATCH).map(([state, style]) => (
        <li key={state} className="flex items-center gap-1.5">
          <span className="inline-block w-6" style={style} aria-hidden />
          {t(`iot.devices.lineage.legend.${state}`)}
        </li>
      ))}
    </ul>
  );
}
