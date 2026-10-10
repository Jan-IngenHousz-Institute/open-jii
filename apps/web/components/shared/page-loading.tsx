"use client";

import { useEffect } from "react";
import { navigationTiming } from "~/lib/navigation-timing";

import { useTranslation } from "@repo/i18n";

/** A page's loading state: what an entity shows while it loads, and what a click shows at once. */
export function PageLoading({ message }: { message?: string }) {
  const { t } = useTranslation("common");

  // A navigation has not settled while its page still shows this.
  useEffect(() => navigationTiming.holdLoadingScreen(), []);

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-muted-foreground">{message ?? t("common.loading")}</div>
    </div>
  );
}
