"use client";

import { useLocale } from "@/hooks/useLocale";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import type { Experiment, ExperimentMember } from "@repo/api";
import { useSession } from "@repo/auth/client";
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

interface ExperimentInfoCardProps {
  experimentId: string;
  experiment: Experiment;
  members: ExperimentMember[];
}

export function ExperimentInfoCard({ experimentId, experiment, members }: ExperimentInfoCardProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data: session } = useSession();
  const currentUserId = session?.user.id;

  const { mutateAsync: updateExperiment, isPending: isUpdating } = useExperimentUpdate();
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const router = useRouter();

  const currentUserRole = members.find((m) => m.user.id === currentUserId)?.role ?? "member";
  const isAdmin = currentUserRole === "admin";

  const isArchived = experiment.status === "archived";

  const handleToggleArchive = async () => {
    const newStatus = isArchived ? "active" : "archived";
    const successMessage = isArchived
      ? t("experimentSettings.experimentUnarchivedSuccess")
      : t("experimentSettings.experimentArchivedSuccess");
    const errorMessage = isArchived
      ? t("experimentSettings.experimentUnarchivedError")
      : t("experimentSettings.experimentArchivedError");
    const redirectPath = isArchived
      ? `/${locale}/platform/experiments`
      : `/${locale}/platform/experiments-archive`;

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
    <>
      <div className="mt-8">
        <p className="text-muted-foreground mb-2 text-sm">{t("experimentSettings.archiveNote")}</p>

        <div className="flex flex-col gap-3 md:flex-row">
          {/* Archive/Unarchive Experiment */}
          <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="bg-surface-dark w-full md:w-fit"
                disabled={!isAdmin}
              >
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
        </div>
      </div>
    </>
  );
}
