"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDeleteApiKey } from "~/hooks/auth/useDeleteApiKey/useDeleteApiKey";

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

export function RevokeApiKeyDialog({ keyId, keyName }: { keyId: string; keyName: string }) {
  const { t } = useTranslation("account");
  const [open, setOpen] = useState(false);
  const deleteApiKey = useDeleteApiKey();

  const handleRevoke = async () => {
    try {
      await deleteApiKey.mutateAsync({ keyId });
      toast({ description: t("apiKeys.revoked") });
      setOpen(false);
    } catch {
      toast({ description: t("apiKeys.revokeError"), variant: "destructive" });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("apiKeys.revoke")}>
          <Trash2 className="text-destructive h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("apiKeys.revokeTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("apiKeys.revokeConfirm", { name: keyName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("apiKeys.cancel")}</AlertDialogCancel>
          <Button variant="destructive" onClick={handleRevoke} disabled={deleteApiKey.isPending}>
            {deleteApiKey.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("apiKeys.revoke")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
