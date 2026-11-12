"use client";

import { useDepartureRouter } from "@/components/navigation/list-departure/list-departure";
import { useLocale } from "@/hooks/useLocale";
import { useSignOut } from "~/hooks/auth/useSignOut/useSignOut";

import { ToastAction } from "@repo/ui/components/toast";
import { toast } from "@repo/ui/hooks/use-toast";

/**
 * Better Auth changes how a person signs in only on a session created within its fresh
 * age (a day); renewing a session never resets that, so only a new sign-in does. The
 * toast's action signs out and comes back to Security after the next sign-in.
 */
export function useSignInAgainToast() {
  const locale = useLocale();
  const router = useDepartureRouter();
  const signOut = useSignOut();

  const signInAgain = async () => {
    await signOut.mutateAsync();
    const callbackUrl = `/${locale}/platform/account/security`;
    router.push(`/${locale}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  };

  return (description: string, actionLabel: string) => {
    toast({
      description,
      variant: "destructive",
      action: (
        <ToastAction altText={actionLabel} onClick={() => void signInAgain()}>
          {actionLabel}
        </ToastAction>
      ),
    });
  };
}
