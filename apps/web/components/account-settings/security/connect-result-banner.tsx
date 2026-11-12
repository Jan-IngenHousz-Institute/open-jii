"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Info, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LINKED_ACCOUNTS_KEY } from "~/hooks/auth/useLinkedAccounts/useLinkedAccounts";
import { isConnectableProvider, PROVIDER_NAMES } from "~/lib/sign-in-providers";
import type { ConnectableProvider } from "~/lib/sign-in-providers";

import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";

// Better Auth adds `error_description` beside `error` when the provider sent one.
const RESULT_PARAMS = ["connected", "connect", "error", "error_description"] as const;

type ConnectResult =
  | { kind: "connected"; provider: ConnectableProvider }
  | {
      kind: "unchanged";
      provider: ConnectableProvider;
      reason: "cancelled" | "alreadyLinked" | "didNotFinish";
    };

/**
 * `connected=` is where a link lands; `connect=` is where Better Auth's error redirect
 * lands, with the library's code appended as `error=`.
 */
function readResult(params: URLSearchParams): ConnectResult | null {
  const connected = params.get("connected");
  if (connected !== null) {
    return isConnectableProvider(connected) ? { kind: "connected", provider: connected } : null;
  }

  const provider = params.get("connect");
  if (!isConnectableProvider(provider)) return null;

  const error = params.get("error");
  const reason =
    error === "access_denied"
      ? "cancelled"
      : error === "account_already_linked_to_different_user"
        ? "alreadyLinked"
        : "didNotFinish";
  return { kind: "unchanged", provider, reason };
}

/**
 * The line Security shows on returning from GitHub or ORCID. The parameters are read
 * once and then dropped from the URL, so a reload does not repeat the line.
 */
export function ConnectResultBanner() {
  const { t } = useTranslation("account");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [result, setResult] = useState(() => readResult(searchParams));

  useEffect(() => {
    if (!searchParams.has("connected") && !searchParams.has("connect")) return;

    if (searchParams.has("connected")) {
      void queryClient.invalidateQueries({ queryKey: LINKED_ACCOUNTS_KEY });
    }
    const remaining = new URLSearchParams(searchParams);
    for (const param of RESULT_PARAMS) remaining.delete(param);
    const query = remaining.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, queryClient, router, searchParams]);

  if (!result) return null;

  const provider = PROVIDER_NAMES[result.provider];
  const title =
    result.kind === "unchanged"
      ? t("signInMethods.nothingChanged")
      : result.provider === "github"
        ? t("signInMethods.connectedGithubTitle")
        : t("signInMethods.connectedOrcidTitle");
  const body =
    result.kind === "connected"
      ? result.provider === "github"
        ? t("signInMethods.connectedGithubBody")
        : t("signInMethods.connectedOrcidBody")
      : result.reason === "cancelled"
        ? t("signInMethods.connectCancelled", { provider })
        : result.reason === "alreadyLinked"
          ? t("signInMethods.connectAlreadyLinked", { provider })
          : t("signInMethods.connectDidNotFinish", { provider });

  return (
    <Alert className="pr-12">
      {result.kind === "connected" ? (
        <CheckCircle2 className="text-status-active-foreground" />
      ) : (
        <Info />
      )}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{body}</AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2"
        aria-label={t("signInMethods.dismiss")}
        onClick={() => setResult(null)}
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
}
