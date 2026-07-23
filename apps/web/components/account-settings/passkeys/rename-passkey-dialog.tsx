"use client";

import { Loader2, Pencil } from "lucide-react";
import { useState } from "react";
import { useUpdatePasskey } from "~/hooks/auth/useUpdatePasskey/useUpdatePasskey";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

import { runMutationWithToast } from "./run-mutation-with-toast";

export function RenamePasskeyDialog({
  passkeyId,
  currentName,
}: {
  passkeyId: string;
  currentName: string;
}) {
  const { t } = useTranslation("account");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const updatePasskey = useUpdatePasskey();

  const handleRename = async () => {
    await runMutationWithToast(
      () => updatePasskey.mutateAsync({ id: passkeyId, name }),
      t("passkeys.renameError"),
      () => setOpen(false),
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setName(currentName);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("passkeys.renameNamed", { name: currentName })}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("passkeys.renameTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="passkey-name">{t("passkeys.name")}</Label>
          <Input id="passkey-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("passkeys.cancel")}
          </Button>
          <Button onClick={handleRename} disabled={!name.trim() || updatePasskey.isPending}>
            {updatePasskey.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("passkeys.rename")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
