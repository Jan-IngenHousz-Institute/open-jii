"use client";

import { useExperimentStandardsFields } from "~/hooks/experiment/useExperimentStandardsFields/useExperimentStandardsFields";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { DialogBody, DialogFooter } from "@repo/ui/components/dialog";
import { Skeleton } from "@repo/ui/components/skeleton";

import { MissingFieldGroup } from "./missing-field-group";
import type { MissingFieldGroup as MissingFieldGroupData } from "./missing-field-groups";
import { groupMissingFields } from "./missing-field-groups";

interface MiappeExportConfirmProps {
  experimentId: string;
  onBack: () => void;
  onExport: () => void;
}

/** The export dialog's confirm step: what the MIAPPE package leaves empty, then Export anyway. */
export function MiappeExportConfirm({ experimentId, onBack, onExport }: MiappeExportConfirmProps) {
  const { t } = useTranslation("standards");
  const { data } = useExperimentStandardsFields(experimentId, "miappe");

  const renderGroup = (group: MissingFieldGroupData) => (
    <MissingFieldGroup
      key={group.reason.code}
      experimentId={experimentId}
      group={group}
      canFix={false}
    />
  );

  return (
    <div className="flex min-h-0 flex-col gap-4 pt-4" data-testid="miappe-export-confirm">
      <DialogBody className="space-y-3">
        {data ? (
          <>
            <div className="space-y-1">
              <h3 className="font-semibold">
                {t("export.confirmTitle", { count: data.total - data.filled })}
              </h3>
              <p className="text-muted-foreground text-sm">{t("export.confirmDescription")}</p>
            </div>
            {groupMissingFields(data.fields).map(renderGroup)}
          </>
        ) : (
          <Skeleton className="h-48 w-full" />
        )}
      </DialogBody>

      <DialogFooter className="mt-2 flex items-center justify-between gap-2 sm:justify-between">
        <Button variant="outline" onClick={onBack}>
          {t("export.back")}
        </Button>
        <Button onClick={onExport}>{t("export.exportAnyway")}</Button>
      </DialogFooter>
    </div>
  );
}
