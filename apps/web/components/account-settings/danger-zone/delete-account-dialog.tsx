"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useSignOut } from "~/hooks/auth/useSignOut/useSignOut";
import { useDeleteUser } from "~/hooks/profile/useDeleteUser/useDeleteUser";
import { useDeletionBlockers } from "~/hooks/profile/useDeletionBlockers/useDeletionBlockers";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
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
import { cn } from "@repo/ui/lib/utils";

import { DeleteAccountBlockers } from "./delete-account-blockers";

interface DeleteAccountDialogProps {
  userId: string;
}

/**
 * The "Delete account" section of the danger zone: a soft-delete confirmation dialog. When the
 * user is the sole admin of one or more experiments, deletion is blocked until those are handed
 * over — surfaced inline via {@link DeleteAccountBlockers}.
 */
export function DeleteAccountDialog({ userId }: DeleteAccountDialogProps) {
  const { t } = useTranslation("account");
  const params = useParams<{ locale: string }>();
  const locale = typeof params.locale === "string" ? params.locale : "en-US";
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  // Lets the transfer (blockers) section take over the dialog body, hiding the description + warning card.
  const [blockersExpanded, setBlockersExpanded] = useState(false);
  const signOut = useSignOut();

  // Experiments where the user is the sole admin block deletion; surfaced when the dialog opens.
  const { data: blockersData, isLoading: isLoadingBlockers } = useDeletionBlockers(userId, {
    enabled: open,
  });
  const blockers = blockersData?.experiments ?? [];
  const hasBlockers = blockers.length > 0;
  // Expanded only matters while blockers remain; once everything is transferred the section
  // collapses on its own so the erase/preserve summary comes back on screen.
  const isExpanded = blockersExpanded && hasBlockers;

  const handleClose = () => {
    setOpen(false);
    setConfirmation("");
    setBlockersExpanded(false);
  };

  // The hook surfaces the error toast itself; success (sign-out + redirect) is handled here.
  const { mutate: deleteAccount, isPending: isDeleting } = useDeleteUser({
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

  const handleDelete = () => {
    deleteAccount({ id: userId });
  };

  return (
    <div className="border-destructive/25 bg-destructive/5 flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h3 className="text-destructive font-medium">{t("dangerZone.delete.title")}</h3>
        <p className="text-muted-foreground text-sm">{t("dangerZone.delete.description")}</p>
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) handleClose();
          else {
            setConfirmation("");
            setOpen(true);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="destructive">{t("dangerZone.delete.button")}</Button>
        </DialogTrigger>

        <DialogContent
          className={cn(
            // Mobile: a single flex column that scrolls its body (dvh so the
            // browser toolbar can't push the footer off-screen). Desktop (sm+):
            // fixed header/footer with an internally-scrolling list.
            "flex max-h-[90dvh] flex-col overflow-hidden p-4 sm:grid sm:grid-cols-1 sm:grid-rows-[auto_minmax(0,1fr)_auto] sm:p-6",
            hasBlockers ? "max-w-2xl" : "max-w-md",
          )}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-destructive">
              {t("dangerZone.delete.dialogTitle")}
            </DialogTitle>
            {!isExpanded && (
              <DialogDescription className="text-muted-foreground">
                {t("dangerZone.delete.dialogDescription")}
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Scroll container on mobile; on desktop the inner list scrolls instead. */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto sm:overflow-visible">
            {/* What deletion erases / preserves — laid out side by side when there's room */}
            {!isExpanded && (
              <div className="border-destructive/30 bg-muted shrink-0 rounded-md border p-3 text-sm">
                <div
                  className={cn(hasBlockers ? "grid gap-x-6 gap-y-3 sm:grid-cols-2" : "space-y-3")}
                >
                  <div>
                    <div className="mb-1.5 flex items-start gap-2">
                      <AlertTriangle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
                      <p className="text-destructive font-medium">
                        {t("dangerZone.delete.warningEraseTitle")}
                      </p>
                    </div>
                    <ul className="text-muted-foreground list-disc space-y-1 pl-6">
                      <li>{t("dangerZone.delete.warningEraseList.profile")}</li>
                      <li>{t("dangerZone.delete.warningEraseList.email")}</li>
                      <li>{t("dangerZone.delete.warningEraseList.teams")}</li>
                    </ul>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-start gap-2">
                      <AlertTriangle className="text-jii-dark-green mt-0.5 h-5 w-5 shrink-0" />
                      <p className="text-jii-dark-green font-medium">
                        {t("dangerZone.delete.warningPreserveTitle")}
                      </p>
                    </div>
                    <ul className="text-muted-foreground list-disc space-y-1 pl-6">
                      <li>{t("dangerZone.delete.warningPreserveList.content")}</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Hand over experiments (fills remaining height, scrolls), or confirm */}
            {isLoadingBlockers ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("dangerZone.delete.blockers.loading")}
              </div>
            ) : hasBlockers ? (
              <DeleteAccountBlockers
                blockers={blockers}
                currentUserId={userId}
                locale={locale}
                expanded={isExpanded}
                onToggleExpanded={() => setBlockersExpanded((v) => !v)}
              />
            ) : (
              <div className="space-y-2">
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
            )}
          </div>

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={handleClose}>
              {t("dangerZone.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={
                confirmation !== t("dangerZone.delete.confirmWord") ||
                isDeleting ||
                isLoadingBlockers ||
                hasBlockers
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
  );
}
