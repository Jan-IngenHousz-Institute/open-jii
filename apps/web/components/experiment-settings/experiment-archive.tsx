"use client";

import { useLocale } from "@/hooks/useLocale";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import { useTranslation } from "@repo/i18n";
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentUpdate } from "../../hooks/experiment/useExperimentUpdate/useExperimentUpdate";

interface ExperimentArchiveProps {
  experimentId: string;
  isArchived: boolean;
}

export function ExperimentArchive({ experimentId, isArchived }: ExperimentArchiveProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const { mutateAsync: updateExperiment, isPending: isUpdating } = useExperimentUpdate();

  const handleToggleArchive = async () => {
    const newStatus = isArchived ? "active" : "archived";
    const successMessage = isArchived
      ? t("experimentSettings.experimentUnarchivedSuccess")
      : t("experimentSettings.experimentArchivedSuccess");
    const errorMessage = isArchived
      ? t("experimentSettings.experimentUnarchivedError")
      : t("experimentSettings.experimentArchivedError");
    const redirectPath = isArchived
      ? `/${locale}/platform/experiments/${experimentId}`
      : `/${locale}/platform/experiments-archive/${experimentId}`;

    await updateExperiment(
      {
        params: { id: experimentId },
        body: { status: newStatus },
      },
      {
        onSuccess: () => {
          toast({ description: successMessage });
          router.push(redirectPath);
        },
        onError: (err) => {
          toast({
            description: parseApiError(err)?.message ?? errorMessage,
            variant: "destructive",
          });
        },
        onSettled: () => {
          setIsArchiveDialogOpen(false);
        },
      },
    );
  };

  return (
    <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="muted">
          {isArchived
            ? t("experimentSettings.unarchiveExperiment")
            : t("experimentSettings.archiveExperiment")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isArchived
              ? t("experimentSettings.unarchivingExperiment")
              : t("experimentSettings.archivingExperiment")}
          </DialogTitle>
          <DialogDescription>
            {isArchived
              ? t("experimentSettings.unarchiveDescription")
              : t("experimentSettings.archiveDescription")}{" "}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setIsArchiveDialogOpen(false)}>
            {t("experimentSettings.cancel")}
          </Button>
          <Button variant="default" onClick={handleToggleArchive} disabled={isUpdating}>
            {isUpdating
              ? t("experimentSettings.saving")
              : isArchived
                ? t("experimentSettings.unarchiveActivate")
                : t("experimentSettings.archiveDeactivate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
