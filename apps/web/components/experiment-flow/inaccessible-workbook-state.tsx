"use client";

import { Lock } from "lucide-react";

import { useTranslation } from "@repo/i18n/client";

/**
 * Shown when an experiment has a workbook attached that the caller cannot read.
 * Visibility is per resource, so being added to the experiment grants nothing on
 * its workbook — without this the design tab renders an empty card and empty tab
 * strip with no reason given. The workbook's name is deliberately absent.
 */
export function InaccessibleWorkbookState() {
  const { t } = useTranslation("experiments");

  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-lg font-medium">{t("flow.title")}</h4>
        <p className="text-muted-foreground text-sm">{t("flow.description")}</p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
        <Lock className="text-muted-foreground mb-4 h-12 w-12" />
        <p className="text-muted-foreground mb-1 text-sm font-medium">
          {t("flow.workbookNotShared")}
        </p>
        <p className="text-muted-foreground max-w-md text-center text-xs">
          {t("flow.workbookNotSharedHint")}
        </p>
      </div>
    </div>
  );
}
