"use client";

import { Fingerprint, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSignInPasskey } from "~/hooks/auth/useSignInPasskey/useSignInPasskey";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

import { LastUsedBadge } from "./last-used-badge";

interface PasskeyLoginButtonProps {
  callbackUrl: string | undefined;
  isLastUsed?: boolean;
}

export function PasskeyLoginButton({ callbackUrl, isLastUsed }: PasskeyLoginButtonProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const signInPasskey = useSignInPasskey();

  const handleClick = async () => {
    try {
      await signInPasskey.mutateAsync(undefined);
      router.push(callbackUrl ?? "/platform");
    } catch {
      // Covers WebAuthn ceremony cancellation too.
      toast({ description: t("auth.passkeyError"), variant: "destructive" });
    }
  };

  return (
    <div className="relative mb-6">
      <Button
        type="button"
        variant="outline"
        className="bg-surface text-foreground hover:bg-surface-light active:bg-surface-dark flex h-12 w-full items-center justify-center rounded-full"
        disabled={signInPasskey.isPending}
        onClick={handleClick}
      >
        {signInPasskey.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Fingerprint className="mr-2 h-5 w-5" />
        )}
        <span className="font-notosans">{t("auth.loginWith-passkey")}</span>
      </Button>
      {isLastUsed && <LastUsedBadge />}
    </div>
  );
}
