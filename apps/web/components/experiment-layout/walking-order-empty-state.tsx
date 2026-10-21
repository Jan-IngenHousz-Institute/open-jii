import { Route } from "lucide-react";
import type { ReactNode } from "react";

import { useTranslation } from "@repo/i18n";
import { EmptyState } from "@repo/ui/components/empty-state";

interface WalkingOrderEmptyStateProps {
  /** The plot the app starts from in layout order, such as A1. */
  firstPlot: string;
  /** Choose a walking order, offered to those who can edit. */
  action?: ReactNode;
}

/** The Walking order view while plots exist and no strategy is chosen. */
export function WalkingOrderEmptyState({ firstPlot, action }: WalkingOrderEmptyStateProps) {
  const { t } = useTranslation("experiments");

  return (
    <EmptyState
      size="page"
      icon={<Route aria-hidden />}
      title={t("layout.walkingOrderEmpty.title")}
      description={t("layout.walkingOrderEmpty.description", { first: firstPlot })}
      action={action}
    />
  );
}
