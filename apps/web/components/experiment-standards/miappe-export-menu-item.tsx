"use client";

import { useExperimentStandardsFields } from "~/hooks/experiment/useExperimentStandardsFields/useExperimentStandardsFields";

import { useTranslation } from "@repo/i18n";
import { DropdownMenuItem } from "@repo/ui/components/dropdown-menu";

interface MiappeExportMenuItemProps {
  experimentId: string;
  /** Asks first, listing what goes out empty. */
  onConfirm: () => void;
  /** Exports at once, since nothing goes out empty. */
  onExport: () => void;
}

/** The MIAPPE package in the export menu's Whole experiment group, saying how many fields go out empty. */
export function MiappeExportMenuItem({
  experimentId,
  onConfirm,
  onExport,
}: MiappeExportMenuItemProps) {
  const { t } = useTranslation("standards");
  const { data } = useExperimentStandardsFields(experimentId, "miappe");

  const emptyFields = data ? data.total - data.filled : 0;
  const hasEmptyFields = emptyFields > 0;
  const detail = hasEmptyFields
    ? t("export.emptyFields", { count: emptyFields })
    : t("export.complete");
  const format = t("export.packageDetail", { name: t("standard.miappe.name") });

  const handleSelect = () => {
    if (hasEmptyFields) {
      onConfirm();
      return;
    }
    onExport();
  };

  return (
    <DropdownMenuItem onSelect={handleSelect} disabled={data === undefined}>
      <div className="flex flex-col gap-0.5">
        <span>{t("standard.miappe.title")}</span>
        <span className="text-muted-foreground text-xs">
          {data ? t("named", { name: format, detail }) : format}
        </span>
      </div>
    </DropdownMenuItem>
  );
}
