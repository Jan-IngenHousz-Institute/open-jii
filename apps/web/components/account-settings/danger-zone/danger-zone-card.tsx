"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useSignOut } from "~/hooks/auth/useSignOut/useSignOut";
import { useCreateUserProfile } from "~/hooks/profile/useCreateUserProfile/useCreateUserProfile";

import type { CreateUserProfileBody } from "@repo/api/domains/user/user.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components/card";
import {
  Dialog,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogContent,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { toast } from "@repo/ui/hooks/use-toast";

import { DeleteAccountDialog } from "./delete-account-dialog";

interface DangerZoneCardProps {
  profile?: CreateUserProfileBody | null;
  userId: string;
}

export function DangerZoneCard({ profile, userId }: DangerZoneCardProps) {
  const { t } = useTranslation("account");
  const [deactivateOpen, setDeactivateOpen] = useState(false);
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
    setDeactivateOpen(false);
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
      avatarUrl: profile?.avatarUrl,
    };
    updateProfile(body, { onSuccess: () => handleClose() });
  };

  const isDeactivateConfirmed = confirmation === t("dangerZone.deactivate.confirmWord");

  const actionLabel = isPending
    ? t("dangerZone.deactivate.buttonSaving")
    : t("dangerZone.deactivate.buttonConfirm");

  return (
    <Card className="border-destructive/30 rounded-md shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-destructive text-lg font-semibold">
          {t("dangerZone.title")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Deactivate Section */}
        <div className="border-destructive/25 bg-destructive/5 flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-destructive font-medium">{t("dangerZone.deactivate.title")}</h3>
            <p className="text-muted-foreground text-sm">
              {t("dangerZone.deactivate.description")}
            </p>
          </div>

          <Dialog
            open={deactivateOpen}
            onOpenChange={(v) => {
              if (!v) handleClose();
              else {
                setConfirmation("");
                setDeactivateOpen(true);
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
        <DeleteAccountDialog userId={userId} />
      </CardContent>
    </Card>
  );
}
