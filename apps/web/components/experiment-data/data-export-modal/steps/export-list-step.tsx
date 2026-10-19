"use client";

import { useTrackExports } from "@/components/activity/use-track-exports";
import { Check, Download, Loader2, Plus } from "lucide-react";
import * as React from "react";
import { useListExports } from "~/hooks/experiment/useListExports/useListExports";
import { parseApiError } from "~/util/apiError";

import type {
  ExperimentExportFormat,
  ExperimentExportRecord,
  ExperimentInitiateExportBody,
} from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { DialogBody, DialogFooter } from "@repo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Skeleton } from "@repo/ui/components/skeleton";

import type { CreationStatus } from "../data-export-modal";
import { EXPORT_FORMATS, EXPORT_FORMAT_LABEL_KEYS } from "../export-format-label-keys";
import { ExportCard } from "./export-card";

interface ExportListStepProps {
  experimentId: string;
  tableName: string;
  displayName?: string;
  onCreateExport: (format: ExperimentInitiateExportBody["format"]) => void;
  onClose: () => void;
  creationStatus?: CreationStatus;
}

export function ExportListStep({
  experimentId,
  tableName,
  displayName,
  onCreateExport,
  onClose,
  creationStatus = "idle",
}: ExportListStepProps) {
  const { t } = useTranslation("experimentData");
  const { data, isLoading, error } = useListExports({ experimentId, tableName });
  const exports = data?.exports ?? [];

  // Mirror every poll into the activity context, which toasts when an export finishes.
  useTrackExports({ experimentId, tableName, displayName, exports });

  const renderExport = (exportRecord: ExperimentExportRecord, index: number) => (
    <ExportCard
      key={exportRecord.exportId}
      export={exportRecord}
      experimentId={experimentId}
      index={exports.length - index}
    />
  );

  const renderFormatItem = (format: ExperimentExportFormat) => (
    <DropdownMenuItem key={format} onClick={() => onCreateExport(format)}>
      {t(EXPORT_FORMAT_LABEL_KEYS[format])}
    </DropdownMenuItem>
  );

  if (error) {
    const errorMessage =
      parseApiError(error)?.message ?? t("experimentData.exportModal.unknownError");
    return (
      <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
        {t("experimentData.exportModal.error")}: {errorMessage}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-4 pt-4">
      <DialogBody className="space-y-4">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">
            {t("experimentData.exportModal.loadingExports")}
          </p>
        ) : exports.length === 0 ? (
          <Card className="items-center justify-center gap-0 py-8">
            <div className="bg-background mb-3 flex h-16 w-16 items-center justify-center rounded-full">
              <Download className="text-muted-foreground h-8 w-8" />
            </div>
            <p className="text-muted-foreground text-center text-sm">
              {t("experimentData.exportModal.noExports")}
            </p>
          </Card>
        ) : (
          <p className="text-muted-foreground text-sm">
            {t("experimentData.exportModal.exportCount", { count: exports.length })}
          </p>
        )}

        {isLoading ? (
          <ScrollArea className="max-h-[280px]">
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="min-h-[56px] flex-row items-center gap-3 px-3 py-2.5">
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-10 rounded" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-3 w-16 rounded" />
                      <Skeleton className="h-3 w-12 rounded" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        ) : (
          exports.length > 0 && (
            <ScrollArea className="max-h-[280px]">
              <div className="space-y-2">{exports.map(renderExport)}</div>
            </ScrollArea>
          )
        )}
      </DialogBody>

      <DialogFooter className="mt-2 flex items-center justify-between gap-2 sm:justify-between">
        <Button variant="outline" onClick={onClose}>
          {t("common.close")}
        </Button>
        {creationStatus === "creating" ? (
          <Button disabled className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("experimentData.exportModal.creating")}
          </Button>
        ) : creationStatus === "success" ? (
          <Button disabled className="gap-2">
            <Check className="animate-in zoom-in-0 h-4 w-4 duration-300" />
            {t("experimentData.exportModal.exportCreated")}
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                {t("experimentData.exportModal.createExport")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {EXPORT_FORMATS.map(renderFormatItem)}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </DialogFooter>
    </div>
  );
}
