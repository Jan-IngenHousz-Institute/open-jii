"use client";

import { Loader2, Plus } from "lucide-react";
import { useAddPasskey } from "~/hooks/auth/useAddPasskey/useAddPasskey";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { runMutationWithToast } from "./run-mutation-with-toast";

// One-click creation: the browser/OS owns the ceremony UI, the passkey is
// labeled from its authenticator (aaguid) and can be renamed in the list.
export function CreatePasskeyButton() {
  const { t } = useTranslation("account");
  const addPasskey = useAddPasskey();

  const handleClick = async () => {
    await runMutationWithToast(() => addPasskey.mutateAsync({}), t("passkeys.addError"));
  };

  return (
    <Button onClick={handleClick} disabled={addPasskey.isPending}>
      {addPasskey.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Plus className="mr-2 h-4 w-4" />
      )}
      {t("passkeys.add")}
    </Button>
  );
}
