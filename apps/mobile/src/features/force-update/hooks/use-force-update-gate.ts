import { useIsRestoring, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Application from "expo-application";
import { useEffect, useMemo, useState } from "react";
import { isUpdateRequired } from "~/features/force-update/domain/gate-decision";
import { fetchForceUpdate } from "~/features/force-update/services/fetch-force-update";
import { onAppForeground } from "~/shared/device/app-lifecycle";
import { useEnvironmentStore } from "~/shared/stores/environment-store";

import type { PageForceUpdateFieldsFragment } from "@repo/cms/lib/__generated/sdk";

const FIVE_MINUTES = 5 * 60 * 1000;

export type ForceUpdateGateStatus = "checking" | "allowed" | "gated";

export interface ForceUpdateGateResult {
  status: ForceUpdateGateStatus;
  gated: boolean;
  gate: PageForceUpdateFieldsFragment | null;
}

/**
 * Decides whether the running app version is gated, from the cached-or-fresh CMS
 * config — works offline and re-checks on launch and resume.
 */
export function useForceUpdateGate(locale = "en-US"): ForceUpdateGateResult {
  const envLoaded = useEnvironmentStore((s) => s.isLoaded);
  const isRestoring = useIsRestoring();
  const queryClient = useQueryClient();
  const [initialCheckReady, setInitialCheckReady] = useState(false);
  const queryKey = useMemo(() => ["contentful", "force-update", locale] as const, [locale]);

  const { data, fetchStatus } = useQuery({
    queryKey,
    queryFn: () => fetchForceUpdate(locale),
    enabled: envLoaded,
    staleTime: FIVE_MINUTES,
    gcTime: Infinity, // keep the last-known gate persisted for offline checks
    refetchOnMount: true,
    networkMode: "offlineFirst",
    meta: { suppressToast: true },
  });

  // Re-check on resume (fresh cache skips the network).
  useEffect(() => {
    if (!envLoaded) return;
    return onAppForeground(() => {
      // prefetchQuery never rejects — a failed refresh keeps the cached decision.
      void queryClient.prefetchQuery({
        queryKey,
        queryFn: () => fetchForceUpdate(locale),
        staleTime: FIVE_MINUTES,
        gcTime: Infinity,
        networkMode: "offlineFirst",
        meta: { suppressToast: true },
      });
    });
  }, [envLoaded, locale, queryClient, queryKey]);

  useEffect(() => {
    setInitialCheckReady(false);
  }, [locale]);

  useEffect(() => {
    if (initialCheckReady || isRestoring || !envLoaded || fetchStatus === "fetching") return;
    setInitialCheckReady(true);
  }, [envLoaded, fetchStatus, initialCheckReady, isRestoring]);

  const gate = data ?? null;
  const running = Application.nativeApplicationVersion ?? "";
  const gated = isUpdateRequired(gate, running, new Date());
  // Never gate local dev builds (they report the unsynced placeholder app.json version).
  const isDev = typeof __DEV__ !== "undefined" && __DEV__;
  const status: ForceUpdateGateStatus = isDev
    ? "allowed"
    : initialCheckReady
      ? gated
        ? "gated"
        : "allowed"
      : "checking";

  return { status, gated: status === "gated", gate };
}
