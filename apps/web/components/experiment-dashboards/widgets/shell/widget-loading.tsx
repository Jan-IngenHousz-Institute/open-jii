"use client";

import { useTranslation } from "@repo/i18n";

export function WidgetLoading() {
  const { t } = useTranslation("experimentDashboards");
  return (
    <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
      {t("ui.messages.loading")}
    </div>
  );
}
