"use client";

import { Plus } from "lucide-react";

import type { ExperimentUploadSourceKind } from "@repo/api/domains/experiment/uploads/experiment-uploads.schema";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import { DialogBody, DialogFooter } from "@repo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import { UploadHistoryPanel } from "./history/upload-history-panel";
import { UploadTransferList } from "./history/upload-transfer-list";
import {
  UPLOAD_SOURCE_KINDS,
  UPLOAD_SOURCE_KIND_LABEL_KEYS,
} from "./upload-source-kind-label-keys";

export interface UploadListViewProps {
  experimentId: string;
  enabled: boolean;
  onNewUpload: (sourceKind: ExperimentUploadSourceKind) => void;
  onClose: () => void;
}

export function UploadListView({
  experimentId,
  enabled,
  onNewUpload,
  onClose,
}: UploadListViewProps) {
  const { t } = useTranslation("experimentData");

  const renderSourceKindItem = (sourceKind: ExperimentUploadSourceKind) => (
    <DropdownMenuItem key={sourceKind} onClick={() => onNewUpload(sourceKind)}>
      {t(UPLOAD_SOURCE_KIND_LABEL_KEYS[sourceKind])}
    </DropdownMenuItem>
  );

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <DialogBody className="space-y-4">
        <UploadTransferList experimentId={experimentId} enabled={enabled} />
        <UploadHistoryPanel experimentId={experimentId} enabled={enabled} />
      </DialogBody>

      <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
        <Button variant="outline" onClick={onClose}>
          {t("common.close")}
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
            {UPLOAD_SOURCE_KINDS.map(renderSourceKindItem)}
          </DropdownMenuContent>
        </DropdownMenu>
      </DialogFooter>
    </div>
  );
}
