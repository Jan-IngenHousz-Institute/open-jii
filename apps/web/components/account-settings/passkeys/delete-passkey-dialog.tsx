"use client";

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
import { toast } from "@repo/ui/hooks/use-toast";

export function DeletePasskeyDialog({
  passkeyId,
  passkeyName,
}: {
  passkeyId: string;
  passkeyName: string;
}) {
  const { t } = useTranslation("account");
  const [open, setOpen] = useState(false);
  const deletePasskey = useDeletePasskey();

  const handleDelete = async () => {
    try {
      await deletePasskey.mutateAsync({ id: passkeyId });
      setOpen(false);
    } catch {
      toast({ description: t("passkeys.deleteError"), variant: "destructive" });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("passkeys.delete")}>
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
