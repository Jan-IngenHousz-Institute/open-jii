"use client";

import { getOrpcError } from "@/lib/orpc";
import { Download } from "lucide-react";
import * as React from "react";
import { useExperiment } from "~/hooks/experiment/useExperiment/useExperiment";
import { useInitiateExport } from "~/hooks/experiment/useInitiateExport/useInitiateExport";
import { parseApiError } from "~/util/apiError";

import { useTranslation } from "@repo/i18n/client";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Label } from "@repo/ui/components/label";
import { toast } from "@repo/ui/hooks/use-toast";

import { ExportListStep } from "./steps/export-list-step";

interface DataExportModalProps {
  experimentId: string;
  tableName: string;
  displayName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type CreationStatus = "idle" | "creating" | "success";

export function DataExportModal({
  experimentId,
  tableName,
  displayName,
  open,
  onOpenChange,
}: DataExportModalProps) {
  const { t } = useTranslation("experimentData");
  const [creationStatus, setCreationStatus] = React.useState<CreationStatus>("idle");

  // Toggle inherits the experiment's stored setting; user can override per-export.
  const { data: experimentData } = useExperiment(experimentId);
  const experimentAnonymize = experimentData?.anonymizeContributors;
  const [anonymizeOverride, setAnonymizeOverride] = React.useState<boolean | undefined>();
  const effectiveAnonymize = anonymizeOverride ?? experimentAnonymize;

  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setCreationStatus("idle");
        setAnonymizeOverride(undefined);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const { mutate: initiateExport } = useInitiateExport({
    onSuccess: () => {
      setCreationStatus("success");
      toast({ description: t("experimentData.exportModal.creationSuccess") });

      setTimeout(() => {
        setCreationStatus("idle");
      }, 2000);
    },
  });

  const handleCreateExport = (format: string) => {
    setCreationStatus("creating");

    initiateExport(
      {
        id: experimentId,
        tableName,
        format: format as "csv" | "ndjson" | "json-array" | "parquet",
        // Omit when not overridden so backend falls back to the stored setting.
        ...(anonymizeOverride !== undefined && {
          anonymizeContributors: anonymizeOverride,
        }),
      },
      {
        onError: (error) => {
          setCreationStatus("idle");
          toast({
            description:
              parseApiError(getOrpcError(error)?.data ?? error)?.message ??
              t("experimentData.exportModal.creationError"),
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t("experimentData.exportModal.title")}
          </DialogTitle>
          <DialogDescription>
            {t("experimentData.exportModal.description", { tableName: displayName ?? tableName })}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 -mb-2 flex items-center gap-2 rounded-md border p-3">
          <Checkbox
            id="export-anonymize-contributors"
            checked={Boolean(effectiveAnonymize)}
            disabled={experimentAnonymize === undefined}
            onCheckedChange={(checked) => setAnonymizeOverride(checked === true)}
          />
          <Label
            htmlFor="export-anonymize-contributors"
            className="cursor-pointer text-xs font-medium"
          >
            {t("experimentData.exportModal.anonymizeContributors")}
            {anonymizeOverride !== undefined &&
              experimentAnonymize !== undefined &&
              anonymizeOverride !== experimentAnonymize && (
                <span className="text-muted-foreground ml-1.5 font-normal">
                  ({t("experimentData.exportModal.overridingDefault")})
                </span>
              )}
          </Label>
        </div>

        <ExportListStep
          experimentId={experimentId}
          tableName={tableName}
          displayName={displayName}
          onCreateExport={handleCreateExport}
          onClose={handleClose}
          creationStatus={creationStatus}
        />
      </DialogContent>
    </Dialog>
  );
}
