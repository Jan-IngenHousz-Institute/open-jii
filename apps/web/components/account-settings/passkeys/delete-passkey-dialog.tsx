"use client";

import { AuthClientError } from "@/hooks/organization/auth-organization-result";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDeletePasskey } from "~/hooks/auth/useDeletePasskey/useDeletePasskey";

import { useTranslation } from "@repo/i18n";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";

import { runMutationWithToast } from "./run-mutation-with-toast";

export function DeletePasskeyDialog({
  passkeyId,
  passkeyName,
  disabled = false,
}: {
  passkeyId: string;
  passkeyName: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation("account");
  const [open, setOpen] = useState(false);
  const deletePasskey = useDeletePasskey();

  const handleDelete = async () => {
    await runMutationWithToast(
      () => deletePasskey.mutateAsync({ id: passkeyId }),
      (error) =>
        error instanceof AuthClientError && error.code === "LAST_SIGN_IN_METHOD"
          ? t("signInMethods.lastSignInMethod")
          : t("passkeys.deleteError"),
      () => setOpen(false),
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={t("passkeys.deleteNamed", { name: passkeyName })}
        >
          <Trash2 className="text-destructive h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("passkeys.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("passkeys.deleteConfirm", { name: passkeyName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("passkeys.cancel")}</AlertDialogCancel>
          <Button variant="destructive" onClick={handleDelete} disabled={deletePasskey.isPending}>
            {deletePasskey.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("passkeys.delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
