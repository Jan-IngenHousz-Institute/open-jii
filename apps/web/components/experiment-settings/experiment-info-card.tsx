"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import { Archive, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";

import type { Experiment } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
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
import { useExperimentMembers } from "../../hooks/experiment/useExperimentMembers/useExperimentMembers";
import { useExperimentUpdate } from "../../hooks/experiment/useExperimentUpdate/useExperimentUpdate";

interface ExperimentInfoCardProps {
  experimentId: string;
  experiment: Experiment;
}

export function ExperimentInfoCard({ experimentId, experiment }: ExperimentInfoCardProps) {
  // Fetch experiment members to get admin info
  const { data: membersData } = useExperimentMembers(experimentId);

  const members = useMemo(() => {
    return membersData?.body ?? [];
  }, [membersData]);

  // Find the admin member (creator)
  const adminMember = useMemo(() => {
    return members.find((m) => m.role === "admin");
  }, [members]);

  // Helper to get name/email from admin member
  const adminName = adminMember
    ? `${adminMember.user.firstName} ${adminMember.user.lastName}`
    : "Unknown";
  const adminEmail = adminMember?.user.email;

  const { mutateAsync: deleteExperiment, isPending: isDeleting } = useExperimentDelete();
  const { mutateAsync: updateExperiment, isPending: isUpdating } = useExperimentUpdate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isUnarchiveDialogOpen, setIsUnarchiveDialogOpen] = useState(false);
  const router = useRouter();

  const { t } = useTranslation();
  const locale = useLocale();

  const handleDeleteExperiment = async () => {
    await deleteExperiment({ params: { id: experimentId } });
    setIsDeleteDialogOpen(false);
    // Navigate to experiments list
    router.push(`/${locale}/platform/experiments`);
  };

  const handleArchiveExperiment = async () => {
    try {
      await updateExperiment({
        params: { id: experimentId },
        body: { status: "archived" },
      });
      setIsArchiveDialogOpen(false);
      toast({ description: t("experimentSettings.experimentArchivedSuccess") });
      // Navigate to experiments archive list
      router.push(`/${locale}/platform/experiments-archive`);
    } catch (error) {
      console.log(error);
      toast({
        description:
          error &&
          typeof error === "object" &&
          "body" in error &&
          error.body &&
          typeof error.body === "object" &&
          "message" in error.body
            ? String(error.body.message)
            : t("experimentSettings.experimentArchivedError"),
        variant: "destructive",
      });
    }
  };

  const handleUnarchiveExperiment = async () => {
    try {
      await updateExperiment({
        params: { id: experimentId },
        body: { status: "active" },
      });
      setIsUnarchiveDialogOpen(false);
      toast({ description: t("experimentSettings.experimentUnarchivedSuccess") });
      // Navigate to experiments list
      router.push(`/${locale}/platform/experiments`);
    } catch (error) {
      toast({
        description:
          error &&
          typeof error === "object" &&
          "body" in error &&
          error.body &&
          typeof error.body === "object" &&
          "message" in error.body
            ? String(error.body.message)
            : t("experimentSettings.experimentUnarchivedError"),
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("experimentSettings.generalSettings")}</CardTitle>
        <CardDescription>{t("experimentSettings.generalDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-x-2">
            <span className="font-medium">{t("experimentSettings.created")} by:</span> {adminName}
            <span className="text-muted-foreground flex items-center gap-x-1">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate text-xs md:max-w-[200px] md:text-sm">{adminEmail}</span>
            </span>
          </div>
          <div>
            <span className="font-medium">{t("experimentSettings.created")}:</span>{" "}
            {formatDate(experiment.createdAt)}
          </div>
          <div>
            <span className="font-medium">{t("experimentSettings.updated")}:</span>{" "}
            {formatDate(experiment.updatedAt)}
          </div>
        </div>

        <div className="border-t pt-4">
          <h5 className="text-destructive mb-2 text-base font-medium">
            {t("experimentSettings.dangerZone")}
          </h5>
          <p className="text-muted-foreground mb-4 text-sm">
            {t("experimentSettings.deleteWarning")}
          </p>

          <div className="flex flex-col gap-3 md:flex-row">
            {/* Delete Experiment */}
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
                    {t("experimentSettings.confirmDelete")} "{experiment.name}"?{" "}
                    {t("experimentSettings.deleteWarning")}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                    {t("experimentSettings.cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteExperiment}
                    disabled={isDeleting}
                  >
                    {isDeleting ? t("experimentSettings.saving") : t("experimentSettings.delete")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Archive/Unarchive Experiment - Show different buttons based on status */}
            {experiment.status === "archived" ? (
              /* Unarchive Dialog */
              <Dialog open={isUnarchiveDialogOpen} onOpenChange={setIsUnarchiveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full md:w-fit">
                    <Archive className="mr-2 h-4 w-4" />
                    {t("experimentSettings.unarchiveExperiment")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("experimentSettings.unarchivingExperiment")}</DialogTitle>
                    <DialogDescription>
                      {t("experimentSettings.unarchiveDescription")}{" "}
                      {t("experimentSettings.confirmUnarchive")} "{experiment.name}"?
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setIsUnarchiveDialogOpen(false)}>
                      {t("experimentSettings.cancel")}
                    </Button>
                    <Button
                      variant="default"
                      onClick={handleUnarchiveExperiment}
                      disabled={isUpdating}
                    >
                      {isUpdating
                        ? t("experimentSettings.saving")
                        : t("experimentSettings.unarchiveActivate")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              /* Archive Dialog */
              <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full md:w-fit">
                    <Archive className="mr-2 h-4 w-4" />
                    {t("experimentSettings.archiveExperiment")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("experimentSettings.archivingExperiment")}</DialogTitle>
                    <DialogDescription>
                      {t("experimentSettings.archiveDescription")}{" "}
                      {t("experimentSettings.confirmArchive")} "{experiment.name}"?
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setIsArchiveDialogOpen(false)}>
                      {t("experimentSettings.cancel")}
                    </Button>
                    <Button
                      variant="default"
                      onClick={handleArchiveExperiment}
                      disabled={isUpdating}
                    >
                      {isUpdating
                        ? t("experimentSettings.saving")
                        : t("experimentSettings.archiveDeactivate")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
