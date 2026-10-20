"use client";

import { useExperimentStandardsFields } from "~/hooks/experiment/useExperimentStandardsFields/useExperimentStandardsFields";

import { useTranslation } from "@repo/i18n";
import { DropdownMenuItem } from "@repo/ui/components/dropdown-menu";

interface MiappeExportMenuItemProps {
  experimentId: string;
}

/** The MIAPPE package in the Create Export menu, with how many checklist fields can be filled. */
export function MiappeExportMenuItem({ experimentId }: MiappeExportMenuItemProps) {
  const { t } = useTranslation("standards");
  const { data } = useExperimentStandardsFields(experimentId, "miappe");

  return (
    <DropdownMenuItem>
      <div className="flex flex-col gap-0.5">
        <span>{t("export.miappe")}</span>
        {data && (
          <span className="text-muted-foreground text-xs">
            {t("export.fillable", { filled: data.filled, total: data.total })}
          </span>
        )}
      </div>
    </DropdownMenuItem>
  );
}
