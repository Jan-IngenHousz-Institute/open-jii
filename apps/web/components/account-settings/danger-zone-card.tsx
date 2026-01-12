"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useSignOut } from "~/hooks/useAuth";
import { useCreateUserProfile } from "~/hooks/profile/useCreateUserProfile/useCreateUserProfile";
import { useDeleteUser } from "~/hooks/profile/useDeleteUser/useDeleteUser";
import { parseApiError } from "~/util/apiError";

import type { CreateUserProfileBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
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

export function DangerZoneCard({ profile, userId }: DangerZoneCardProps) {
  const { t } = useTranslation("account");
  const [openModal, setOpenModal] = useState<"deactivate" | "delete" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const signOut = useSignOut();

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

  const actionLabel = isPending
    ? t("dangerZone.deactivate.buttonSaving")
    : t("dangerZone.deactivate.buttonConfirm");

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
                    "{t("dangerZone.deactivate.confirmWord")}"
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
                    "{t("dangerZone.delete.confirmWord")}"
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
                  disabled={confirmation !== t("dangerZone.delete.confirmWord") || isDeleting}
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
