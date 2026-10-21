import { Grid3x3 } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";

interface LayoutNeedsPlotsProps {
  view: "walking-order" | "field-days";
  canEdit: boolean;
  onDefineLayout: () => void;
}

const COPY = {
  "walking-order": {
    title: "layout.needsPlots.walkingOrderTitle",
    description: "layout.needsPlots.walkingOrder",
  },
  "field-days": {
    title: "layout.needsPlots.fieldDaysTitle",
    description: "layout.needsPlots.fieldDays",
  },
} as const;

/** The Walking order and Field days views before the experiment has plots. */
export function LayoutNeedsPlots({ view, canEdit, onDefineLayout }: LayoutNeedsPlotsProps) {
  const { t } = useTranslation("experiments");
  const copy = COPY[view];

  return (
    <EmptyState
      size="page"
      icon={<Grid3x3 aria-hidden />}
      title={t(copy.title)}
      description={canEdit ? t(copy.description) : t("layout.needsPlots.viewer")}
      action={
        canEdit ? (
          <Button variant="outline" onClick={onDefineLayout}>
            {t("layout.firstRun.define")}
          </Button>
        ) : undefined
      }
    />
  );
}
