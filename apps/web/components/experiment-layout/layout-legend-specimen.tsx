import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { PlotCategories, PlotShares } from "./plot-state";
import type { PlotStateCellProps } from "./plot-state-cell";
import { PlotStateCell } from "./plot-state-cell";
import { PlotStateLegend } from "./plot-state-legend";

const CATEGORIES = new PlotCategories(["Control", "Drought", "Severe drought"]);
const SHARES = new PlotShares(["Seed User", "Alex Example"]);

const SPECIMENS: readonly PlotStateCellProps[] = [
  { kind: "plot", identifier: "A1", category: CATEGORIES.get("Severe drought") },
  {
    kind: "plot",
    identifier: "A2",
    category: CATEGORIES.get("Control"),
    share: SHARES.at(1),
    mark: "measured",
  },
  {
    kind: "plot",
    identifier: "A4",
    category: CATEGORIES.get("Severe drought"),
    share: SHARES.at(0),
    mark: "skipped",
  },
  {
    kind: "plot",
    identifier: "C4",
    category: CATEGORIES.get("Drought"),
    share: SHARES.at(0),
    mark: "current",
  },
  {
    kind: "plot",
    identifier: "D6",
    category: CATEGORIES.get("Drought"),
    share: SHARES.at(0),
    mark: "measuredTwice",
  },
  {
    kind: "plot",
    identifier: "B6",
    category: CATEGORIES.get("Severe drought"),
    share: SHARES.at(0),
    mark: "flagged",
  },
  {
    kind: "plot",
    identifier: "F2",
    category: CATEGORIES.get("Severe drought"),
    share: SHARES.at(1),
    mark: "uploadFailed",
  },
  {
    kind: "plot",
    identifier: "D5",
    category: CATEGORIES.get("Control"),
    share: SHARES.at(1),
    mark: "outsideShare",
  },
  {
    kind: "plot",
    identifier: "D4",
    category: CATEGORIES.get("Severe drought"),
    share: SHARES.at(1),
    isDimmed: true,
  },
  { kind: "gap" },
  { kind: "removed", identifier: "C5" },
];

/** Scaffold only: every look of the plot-state legend in one row, for the C2 ticket's screen. */
export function LayoutLegendSpecimen() {
  const { t } = useTranslation("experiments");

  const renderSpecimen = (specimen: PlotStateCellProps, index: number) => (
    <div key={index} className="h-11 w-16">
      <PlotStateCell {...specimen} />
    </div>
  );

  return (
    <Card data-legend-specimen>
      <CardHeader>
        <CardTitle>{t("layout.legend.specimenTitle")}</CardTitle>
        <CardDescription>{t("layout.legend.specimenDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">{SPECIMENS.map(renderSpecimen)}</div>
        <PlotStateLegend
          categoryName="Treatment"
          categories={CATEGORIES}
          shares={SHARES}
          entries={[
            "measured",
            "skipped",
            "current",
            "measuredTwice",
            "flagged",
            "uploadFailed",
            "outsideShare",
            "notYours",
            "gap",
            "removed",
          ]}
        />
      </CardContent>
    </Card>
  );
}
