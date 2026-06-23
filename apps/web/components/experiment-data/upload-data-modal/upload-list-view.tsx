"use client";

import { Plus } from "lucide-react";

import type { ExperimentUploadSourceKind } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import { DialogFooter } from "@repo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import { UploadHistoryPanel } from "./history/upload-history-panel";

export interface UploadListViewProps {
  experimentId: string;
  enabled: boolean;
  onNewUpload: (sourceKind: ExperimentUploadSourceKind) => void;
  onClose: () => void;
}

// Ambyte is folder-based, so it sits last after the file-based tabular kinds.
const SOURCE_KIND_ORDER: ExperimentUploadSourceKind[] = [
  "csv",
  "tsv",
  "parquet",
  "xlsx",
  "json",
  "ndjson",
  "ambyte",
];

export function UploadListView({
  experimentId,
  enabled,
  onNewUpload,
  onClose,
}: UploadListViewProps) {
  const { t } = useTranslation("experimentData");

  return (
    <div className="flex flex-col gap-4">
      <UploadHistoryPanel experimentId={experimentId} enabled={enabled} />

      <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
        <Button variant="outline" onClick={onClose}>
          {t("experimentData.uploadDataModal.actions.close")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t("experimentData.uploadDataModal.actions.newUpload")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[var(--radix-dropdown-menu-trigger-width)]"
          >
            {SOURCE_KIND_ORDER.map((kind) => (
              <DropdownMenuItem key={kind} onClick={() => onNewUpload(kind)}>
                {t(`experimentData.uploadDataModal.history.sourceKind.${kind}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </DialogFooter>
    </div>
  );
}
