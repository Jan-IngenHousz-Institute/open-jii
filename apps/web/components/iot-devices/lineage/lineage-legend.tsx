"use client";

import { useTranslation } from "@repo/i18n";

const SWATCH: Record<string, React.CSSProperties> = {
  active: { borderTop: "2px solid #005e5e" },
  silent: { borderTop: "2px dashed #CDD5DB" },
  unbound: { borderTop: "2px dashed #D97706" },
  unattributed: { borderTop: "2px dashed #94A3B8" },
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
