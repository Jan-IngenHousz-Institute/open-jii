import { Grid3x3 } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { EmptyState } from "@repo/ui/components/empty-state";

interface LayoutFirstRunProps {
  /** Opens the setup form, offered only to those who can edit the layout. */
  onDefine?: () => void;
}

/** The Plots view before the experiment has a layout. */
export function LayoutFirstRun({ onDefine }: LayoutFirstRunProps) {
  const { t } = useTranslation("experiments");
  const canDefine = onDefine !== undefined;

  return (
    <EmptyState
      size="page"
      icon={<Grid3x3 aria-hidden />}
      title={t("layout.firstRun.title")}
      description={canDefine ? t("layout.firstRun.description") : t("layout.needsPlots.viewer")}
      action={
        canDefine ? <Button onClick={onDefine}>{t("layout.firstRun.define")}</Button> : undefined
      }
    />
  );
}
