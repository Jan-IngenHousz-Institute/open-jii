"use client";

import { useLocale } from "@/hooks/useLocale";
import { useRouter } from "next/navigation";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import { FEATURE_FLAGS } from "@repo/analytics";
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

import { useExperimentDelete } from "../../hooks/experiment/useExperimentDelete/useExperimentDelete";

interface ExperimentDeleteProps {
  experimentId: string;
  experimentName: string;
}

export function ExperimentDelete({ experimentId, experimentName }: ExperimentDeleteProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { mutateAsync: deleteExperiment, isPending: isDeleting } = useExperimentDelete();
  const isDeletionEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.EXPERIMENT_DELETION);

  if (!isDeletionEnabled) {
    return null;
  }

  const handleDeleteExperiment = async () => {
    try {
      await deleteExperiment(
        {
          params: { id: experimentId },
        },
        {
          onSuccess: () => {
            toast({ description: t("experimentSettings.experimentDeletedSuccess") });
            router.push(`/${locale}/platform/experiments`);
          },
          onError: (err) => {
            toast({
              description:
                parseApiError(err)?.message ?? t("experimentSettings.experimentDeletedError"),
              variant: "destructive",
            });
          },
          onSettled: () => {
            setIsDeleteDialogOpen(false);
          },
        },
      );
    } catch {
      // Error already handled by onError callback
    }
  };

  return (
    <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-full md:w-fit">
          {t("experimentSettings.deleteExperiment")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">
            {t("experimentSettings.deleteExperiment")}
          </DialogTitle>
          <DialogDescription>
            {t("common.confirmDelete", { name: experimentName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
            {t("experimentSettings.cancel")}
          </Button>
          <Button variant="destructive" onClick={handleDeleteExperiment} disabled={isDeleting}>
            {isDeleting ? t("experimentSettings.saving") : t("experimentSettings.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
