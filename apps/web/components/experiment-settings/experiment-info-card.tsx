"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatDate } from "@/util/date";
import { Mail } from "lucide-react";
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

import { useExperimentDelete } from "../../hooks/experiment/useExperimentDelete/useExperimentDelete";
import { useExperimentMembers } from "../../hooks/experiment/useExperimentMembers/useExperimentMembers";

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
  const adminName =
    (adminMember?.user.name ?? adminMember?.user.email ?? experiment.createdBy) || "Unknown";
  const adminEmail = adminMember?.user.email;

  const { mutateAsync: deleteExperiment, isPending: isDeleting } = useExperimentDelete();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const router = useRouter();

  const { t } = useTranslation();
  const locale = useLocale();

  const handleDeleteExperiment = async () => {
    await deleteExperiment({ params: { id: experimentId } });
    setIsDeleteDialogOpen(false);
    // Navigate to experiments list
    router.push(`/${locale}/platform/experiments`);
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

          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">{t("experimentSettings.deleteExperiment")}</Button>
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
        </div>
      </CardContent>
    </Card>
  );
}
