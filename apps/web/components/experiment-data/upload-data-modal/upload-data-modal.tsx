"use client";

import { Upload } from "lucide-react";
import * as React from "react";

import type { ExperimentUploadSourceKind } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";

import { UploadCreateView } from "./upload-create-view";
import { UploadListView } from "./upload-list-view";

export interface UploadDataModalProps {
  experimentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type UploadView = { name: "list" } | { name: "create"; sourceKind: ExperimentUploadSourceKind };

export function UploadDataModal({ experimentId, open, onOpenChange }: UploadDataModalProps) {
  const { t } = useTranslation("experimentData");
  const [view, setView] = React.useState<UploadView>({ name: "list" });

  React.useEffect(() => {
    if (open) {
      setView({ name: "list" });
    }
  }, [open]);

  const isCreating = view.name === "create";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t("experimentData.uploadDataModal.title")}
          </DialogTitle>
          <DialogDescription>
            {isCreating
              ? t("experimentData.uploadDataModal.createDescription")
              : t("experimentData.uploadDataModal.description")}
          </DialogDescription>
        </DialogHeader>

        {view.name === "create" ? (
          <UploadCreateView
            experimentId={experimentId}
            sourceKind={view.sourceKind}
            onBack={() => setView({ name: "list" })}
            onUploaded={() => setView({ name: "list" })}
          />
        ) : (
          <UploadListView
            experimentId={experimentId}
            enabled={open}
            onNewUpload={(sourceKind) => setView({ name: "create", sourceKind })}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
