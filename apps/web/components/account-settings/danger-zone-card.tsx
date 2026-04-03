"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useSignOut } from "~/hooks/auth/useSignOut/useSignOut";
import { useCreateUserProfile } from "~/hooks/profile/useCreateUserProfile/useCreateUserProfile";
import { useDeleteUser } from "~/hooks/profile/useDeleteUser/useDeleteUser";
import { tsr } from "~/lib/tsr";
import { parseApiError } from "~/util/apiError";

import type { CreateUserProfileBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Dialog,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  DialogContent,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

interface DangerZoneCardProps {
  profile?: CreateUserProfileBody | null;
  userId: string;
}

const statusVariantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  archived: "secondary",
  stale: "outline",
  published: "default",
};

export function DangerZoneCard({ profile, userId }: DangerZoneCardProps) {
  const { t } = useTranslation("account");
  const [openModal, setOpenModal] = useState<"deactivate" | "delete" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [transferEmail, setTransferEmail] = useState("");
  const signOut = useSignOut();

  // Fetch deletion check when dialog opens
  const { data: deletionCheck, refetch: refetchDeletionCheck } =
    tsr.users.getDeletionCheck.useQuery({
      queryData: { params: { id: userId } },
      queryKey: ["deletionCheck", userId],
      enabled: openModal === "delete",
    });

  const blockingExperiments = deletionCheck?.body.blockingExperiments ?? [];
  const canDelete = deletionCheck?.body.canDelete ?? false;

  // Bulk transfer mutation
  const { mutateAsync: bulkTransfer, isPending: isTransferring } =
    tsr.users.bulkTransferAdmin.useMutation();

  const { mutate: updateProfile, isPending } = useCreateUserProfile({
    onSuccess: async () => {
      toast({ description: t("dangerZone.deactivate.successMessage") });
      // Sign out after deactivation
      if (profile?.activated) {
        await signOut.mutateAsync();
        window.location.href = "/";
      }
    },
  });

  const handleClose = () => {
    setOpenModal(null);
    setConfirmation("");
    setTransferEmail("");
  };

  // Deactivate handler - only supports deactivation from the UI
  const handleDeactivate = () => {
    const body: CreateUserProfileBody = {
      firstName: profile?.firstName ?? "User",
      lastName: profile?.lastName ?? "User",
      bio: profile?.bio,
      organization: profile?.organization,
      activated: false,
    };
    updateProfile({ body }, { onSuccess: () => handleClose() });
  };

  const isDeactivateConfirmed = confirmation === t("dangerZone.deactivate.confirmWord");

  // Delete hook with improved success message for soft-delete
  const { mutateAsync: deleteAccount, isPending: isDeleting } = useDeleteUser({
    onSuccess: async () => {
      toast({
        description: t("dangerZone.delete.successMessage"),
      });
      handleClose();
      // Sign out after successful deletion
      await signOut.mutateAsync();
      window.location.href = "/";
    },
  });

  const handleDelete = async () => {
    try {
      await deleteAccount({ params: { id: userId } });
    } catch (err) {
      toast({ description: parseApiError(err)?.message, variant: "destructive" });
    }
  };

  const handleTransfer = async () => {
    try {
      await bulkTransfer({
        params: { id: userId },
        body: { email: transferEmail },
      });
      toast({ description: t("dangerZone.delete.transferSuccess") });
      setTransferEmail("");
      await refetchDeletionCheck();
    } catch (err) {
      toast({
        description: parseApiError(err)?.message ?? t("dangerZone.delete.transferError"),
        variant: "destructive",
      });
    }
  };

  const actionLabel = isPending
    ? t("dangerZone.deactivate.buttonSaving")
    : t("dangerZone.deactivate.buttonConfirm");

  const statusLabel = (status: string) => {
    const key = `dangerZone.delete.status${status.charAt(0).toUpperCase() + status.slice(1)}` as
      | "dangerZone.delete.statusActive"
      | "dangerZone.delete.statusArchived"
      | "dangerZone.delete.statusStale"
      | "dangerZone.delete.statusPublished";
    return t(key);
  };

  return (
    <Card className="border-destructive/40 mt-8 rounded-md">
      <CardHeader>
        <CardTitle className="text-destructive text-lg font-semibold">
          {t("dangerZone.title")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Deactivate Section */}
        <div className="border-destructive/30 flex items-center justify-between rounded-md border p-4">
          <div>
            <h3 className="text-destructive font-medium">{t("dangerZone.deactivate.title")}</h3>
            <p className="text-muted-foreground text-sm">
              {t("dangerZone.deactivate.description")}
            </p>
          </div>

          <Dialog
            open={openModal === "deactivate"}
            onOpenChange={(v) => {
              if (!v) handleClose();
              else {
                setConfirmation("");
                setOpenModal("deactivate");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="text-destructive border-destructive hover:bg-destructive/10"
                disabled={!profile?.activated}
              >
                {profile?.activated
                  ? t("dangerZone.deactivate.button")
                  : t("dangerZone.deactivate.buttonDeactivated")}
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-destructive">
                  {t("dangerZone.deactivate.dialogTitle")}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {t("dangerZone.deactivate.dialogDescription")}
                </DialogDescription>
              </DialogHeader>

              {/* Warning box about deactivation */}
              <div className="border-destructive/30 bg-muted mt-3 rounded-md border p-3 text-sm">
                <div className="mb-2 flex items-start gap-2">
                  <AlertTriangle className="text-destructive mt-0.5 h-5 w-5" />
                  <p className="text-destructive font-medium">
                    {t("dangerZone.deactivate.warningTitle")}
                  </p>
                </div>
                <ul className="text-muted-foreground list-disc space-y-1 pl-6">
                  <li>{t("dangerZone.deactivate.warningList.profileHidden")}</li>
                  <li>{t("dangerZone.deactivate.warningList.noRequests")}</li>
                  <li>{t("dangerZone.deactivate.warningList.contentAccessible")}</li>
                  <li>{t("dangerZone.deactivate.warningList.loggedOut")}</li>
                  <li>{t("dangerZone.deactivate.warningList.canReactivate")}</li>
                </ul>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-muted-foreground text-sm">
                  {t("dangerZone.deactivate.confirmPrompt")}{" "}
                  <span className="text-destructive font-semibold">
                    &quot;{t("dangerZone.deactivate.confirmWord")}&quot;
                  </span>{" "}
                  {t("dangerZone.deactivate.confirmSuffix")}
                </p>
                <Input
                  placeholder={t("dangerZone.deactivate.confirmPlaceholder")}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </div>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={handleClose} disabled={isPending}>
                  {t("dangerZone.cancel")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeactivate}
                  disabled={!isDeactivateConfirmed || isPending}
                >
                  {actionLabel}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Delete Section */}
        <div className="border-destructive/30 flex items-center justify-between rounded-md border p-4">
          <div>
            <h3 className="text-destructive font-medium">{t("dangerZone.delete.title")}</h3>
            <p className="text-muted-foreground text-sm">{t("dangerZone.delete.description")}</p>
          </div>

          <Dialog
            open={openModal === "delete"}
            onOpenChange={(v) => {
              if (!v) handleClose();
              else {
                setConfirmation("");
                setTransferEmail("");
                setOpenModal("delete");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="destructive">{t("dangerZone.delete.button")}</Button>
            </DialogTrigger>

            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-destructive">
                  {t("dangerZone.delete.dialogTitle")}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {t("dangerZone.delete.dialogDescription")}
                </DialogDescription>
              </DialogHeader>

              {/* Blocking experiments section */}
              {blockingExperiments.length > 0 && (
                <div className="border-warning/30 bg-muted mt-3 rounded-md border p-3 text-sm">
                  <div className="mb-2 flex items-start gap-2">
                    <AlertTriangle className="text-warning mt-0.5 h-5 w-5 shrink-0" />
                    <p className="font-medium">{t("dangerZone.delete.blockingTitle")}</p>
                  </div>
                  <ul className="mb-3 space-y-1.5 pl-7">
                    {blockingExperiments.map((exp) => (
                      <li key={exp.id} className="flex items-center gap-2">
                        <span className="text-foreground">{exp.name}</span>
                        <Badge variant={statusVariantMap[exp.status] ?? "outline"}>
                          {statusLabel(exp.status)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground pl-7">
                    {t("dangerZone.delete.blockingDescription")}
                  </p>
                  <div className="mt-3 space-y-2 pl-7">
                    <label className="text-foreground text-sm font-medium">
                      {t("dangerZone.delete.transferLabel")}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder={t("dangerZone.delete.transferPlaceholder")}
                        value={transferEmail}
                        onChange={(e) => setTransferEmail(e.target.value)}
                      />
                      <Button
                        size="sm"
                        onClick={handleTransfer}
                        disabled={!transferEmail || isTransferring}
                      >
                        {isTransferring
                          ? t("dangerZone.delete.transferring")
                          : t("dangerZone.delete.transferButton")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Red warning box */}
              <div className="border-destructive/30 bg-muted mt-3 rounded-md border p-3 text-sm">
                <div className="mb-2 flex items-start gap-2">
                  <AlertTriangle className="text-destructive mt-0.5 h-5 w-5" />
                  <p className="text-destructive font-medium">
                    {t("dangerZone.delete.warningEraseTitle")}
                  </p>
                </div>
                <ul className="text-muted-foreground list-disc space-y-1 pl-6">
                  <li>{t("dangerZone.delete.warningEraseList.profile")}</li>
                  <li>{t("dangerZone.delete.warningEraseList.email")}</li>
                  <li>{t("dangerZone.delete.warningEraseList.teams")}</li>
                </ul>
                <div className="mb-2 mt-3 flex items-start gap-2">
                  <AlertTriangle className="text-jii-dark-green mt-0.5 h-5 w-5" />
                  <p className="text-jii-dark-green font-medium">
                    {t("dangerZone.delete.warningPreserveTitle")}
                  </p>
                </div>
                <ul className="text-muted-foreground list-disc space-y-1 pl-6">
                  <li>{t("dangerZone.delete.warningPreserveList.content")}</li>
                </ul>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-muted-foreground text-sm">
                  {t("dangerZone.delete.confirmPrompt")}{" "}
                  <span className="text-destructive font-semibold">
                    &quot;{t("dangerZone.delete.confirmWord")}&quot;
                  </span>{" "}
                  {t("dangerZone.delete.confirmSuffix")}
                </p>
                <Input
                  placeholder={t("dangerZone.delete.confirmPlaceholder")}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </div>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={handleClose}>
                  {t("dangerZone.cancel")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={
                    confirmation !== t("dangerZone.delete.confirmWord") || isDeleting || !canDelete
                  }
                >
                  {isDeleting
                    ? t("dangerZone.delete.buttonDeleting")
                    : t("dangerZone.delete.buttonConfirm")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
