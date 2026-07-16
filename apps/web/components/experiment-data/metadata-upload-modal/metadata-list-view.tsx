import { useExperimentMetadataDelete } from "@/hooks/experiment/useExperimentMetadataDelete/useExperimentMetadataDelete";
import { ArrowLeft, FileSpreadsheet, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type { ExperimentMetadata } from "@repo/api/domains/experiment/metadata/experiment-metadata.schema";
import { useTranslation } from "@repo/i18n/client";
import { Button } from "@repo/ui/components/button";
import { DialogFooter } from "@repo/ui/components/dialog";
import { ScrollArea } from "@repo/ui/components/scroll-area";

import { asStoredMetadata } from "./form-helpers";
import type { DeleteStatus } from "./metadata-card";
import { MetadataCard } from "./metadata-card";

interface MetadataListViewProps {
  experimentId: string;
  records: ExperimentMetadata[];
  onEdit: (metadataId: string) => void;
  onAddNew: () => void;
  onClose: () => void;
}

export function MetadataListView({
  experimentId,
  records,
  onEdit,
  onAddNew,
  onClose,
}: MetadataListViewProps) {
  const { t } = useTranslation("experiments");
  const deleteMutation = useExperimentMetadataDelete();
  const [isDeleting, setIsDeleting] = useState<Record<string, DeleteStatus>>({});
  // Snapshot deleted records so the card stays mounted during the exit animation.
  const [exitingRecords, setExitingRecords] = useState<Record<string, ExperimentMetadata>>({});

  const handleDelete = useCallback(
    async (metadataId: string) => {
      const record = records.find((r) => r.metadataId === metadataId);
      if (record) setExitingRecords((prev) => ({ ...prev, [metadataId]: record }));
      setIsDeleting((prev) => ({ ...prev, [metadataId]: "deleting" }));
      const cleanup = () => {
        setExitingRecords((prev) => {
          const next = { ...prev };
          delete next[metadataId];
          return next;
        });
        setIsDeleting((prev) => {
          const next = { ...prev };
          delete next[metadataId];
          return next;
        });
      };
      try {
        await deleteMutation.mutateAsync({ id: experimentId, metadataId });
        setIsDeleting((prev) => ({ ...prev, [metadataId]: "deleted" }));
        await new Promise((r) => setTimeout(r, 600));
        cleanup();
      } catch {
        cleanup();
      }
    },
    [deleteMutation, experimentId, records],
  );

  const displayRecords = useMemo(() => {
    const ids = new Set(records.map((r) => r.metadataId));
    const extras = Object.values(exitingRecords).filter((r) => !ids.has(r.metadataId));
    return [...records, ...extras];
  }, [records, exitingRecords]);

  const isEmpty = records.length === 0 && Object.keys(exitingRecords).length === 0;

  return (
    <div className="flex flex-col gap-4 pt-4">
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-gray-50 py-8 dark:bg-gray-900">
          <div className="bg-muted mb-3 flex h-16 w-16 items-center justify-center rounded-full">
            <FileSpreadsheet className="text-muted-foreground h-8 w-8" />
          </div>
          <p className="text-muted-foreground text-center text-sm">
            {t("uploadModal.metadata.noMetadata", { defaultValue: "No metadata uploaded yet." })}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {records.length} metadata record{records.length !== 1 ? "s" : ""}
          </p>
          <ScrollArea className="max-h-[320px]">
            <div className="space-y-2">
              {displayRecords.map((record) => {
                const meta = asStoredMetadata(record);
                return (
                  <MetadataCard
                    key={record.metadataId}
                    name={meta.name}
                    identifierColumnId={meta.identifierColumnId}
                    rowCount={meta.rows?.length ?? 0}
                    columnNames={(meta.columns ?? []).map((c) => c.name).filter(Boolean)}
                    updatedAt={record.updatedAt}
                    onEdit={() => onEdit(record.metadataId)}
                    onDelete={() => handleDelete(record.metadataId)}
                    deleteStatus={isDeleting[record.metadataId] ?? "idle"}
                  />
                );
              })}
            </div>
          </ScrollArea>
        </>
      )}

      <DialogFooter className="mt-2 flex items-center justify-between gap-2 sm:justify-between">
        <Button variant="outline" onClick={onClose}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("uploadModal.fileUpload.back")}
        </Button>
        <Button onClick={onAddNew} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("uploadModal.metadata.addNew", { defaultValue: "Add new" })}
        </Button>
      </DialogFooter>
    </div>
  );
}
