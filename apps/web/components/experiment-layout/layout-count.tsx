import { useTranslation } from "@repo/i18n";

import { UnitName } from "./unit-name";

interface LayoutCountProps {
  levelName: string;
  plots: number;
  gaps: number;
}

/** "46 plots, 2 gaps", in the layout's own unit name. */
export function LayoutCount({ levelName, plots, gaps }: LayoutCountProps) {
  const { t } = useTranslation("experiments");
  const unitName = new UnitName(levelName);

  return (
    <>
      {t("layout.countPair", {
        plots: t("layout.plotCount", unitName.forCount(plots)),
        gaps: t("layout.gapCount", { count: gaps }),
      })}
    </>
  );
}
