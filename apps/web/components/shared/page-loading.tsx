"use client";

import { useTranslation } from "@repo/i18n";

/** A page's loading state: what an entity shows while it loads, and what a click shows at once. */
export function PageLoading({ message }: { message?: string }) {
  const { t } = useTranslation("common");

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-muted-foreground">{message ?? t("common.loading")}</div>
    </div>
  );
}
