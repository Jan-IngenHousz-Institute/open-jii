"use client";

import { useLocale } from "@/hooks/useLocale";
import { reloadPage } from "@/lib/reload-page";
import { settledIdentity, SIGNED_OUT } from "@/lib/session-identity";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { authClient, useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

const RELOAD_KEY = "openjii.principal-reload";
const RECHECKS = 3;
const RECHECK_TIMEOUT_MS = 5_000;
const RECHECK_DELAY_MS = 1_000;

// A mismatch that survives a reload is not reloaded again, so the page cannot loop.
function reloadOnce(marker: string) {
  try {
    if (window.sessionStorage.getItem(RELOAD_KEY) === marker) return false;
    window.sessionStorage.setItem(RELOAD_KEY, marker);
  } catch {
    // Without storage the reload still happens; only the loop guard is lost.
  }
  reloadPage();
  return true;
}

function clearReloadMarker() {
  try {
    window.sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    // Nothing to reset.
  }
}

function withinTimeout<T>(work: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), RECHECK_TIMEOUT_MS);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

// Who the server says is signed in now, or undefined when it could not say in time.
async function recheck() {
  try {
    const result = await withinTimeout(authClient.getSession());
    if (!result || result.error) return undefined;
    return result.data?.user.id ?? SIGNED_OUT;
  } catch {
    return undefined;
  }
}

/**
 * Renders the platform only for the person the server rendered it for. Its pages carry that
 * person's data into the query cache, so once the browser's session settles on someone else the
 * page is reloaded for them instead. A pending session or a failed refetch changes nothing.
 */
export function PrincipalGate({ userId, children }: { userId: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useSession();
  const { refetch } = session;
  const identity = settledIdentity(session);
  const [settled, setSettled] = useState<string>();
  if (identity !== undefined && identity !== settled) setSettled(identity);
  const current = identity ?? settled;
  const open = current === undefined || current === userId;
  const [stuck, setStuck] = useState(false);
  if (open && stuck) setStuck(false);

  useEffect(() => {
    if (open && current === userId) clearReloadMarker();
  }, [open, current, userId]);

  useEffect(() => {
    if (open) return;
    void queryClient.cancelQueries();
    queryClient.clear();
    let active = true;
    const stopped = () => !active;
    void (async () => {
      for (let attempt = 0; attempt < RECHECKS; attempt++) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, RECHECK_DELAY_MS));
        if (stopped()) return;
        const fresh = await recheck();
        if (stopped()) return;
        if (fresh === undefined) continue;
        if (fresh !== userId) {
          if (!reloadOnce(`${userId}>${fresh}`)) setStuck(true);
          return;
        }
        // Only the browser's copy was stale: once it is refreshed the gate opens by itself.
        await withinTimeout(refetch());
      }
      if (!stopped()) setStuck(true);
    })();
    return () => {
      active = false;
    };
  }, [open, queryClient, refetch, userId]);

  if (open) return children;
  return stuck ? <PrincipalRecovery /> : null;
}

// Says nothing about either person, so it is safe whoever is looking.
function PrincipalRecovery() {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 p-8 text-center">
      <h1 className="text-lg font-semibold">{t("principalGate.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("principalGate.description")}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          onClick={() => {
            clearReloadMarker();
            reloadPage();
          }}
        >
          {t("principalGate.reload")}
        </Button>
        <Button variant="outline" asChild>
          <a href={`/${locale}/login`}>{t("principalGate.signIn")}</a>
        </Button>
      </div>
    </div>
  );
}
