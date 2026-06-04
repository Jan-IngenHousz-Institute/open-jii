import { useIsRestoring, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Application from "expo-application";
import { useEffect, useMemo, useState } from "react";
import { fetchForceUpdate } from "~/features/force-update/services/fetch-force-update";
import { isVersionBelow } from "~/features/force-update/utils/compare-version";
import { useEnvironmentStore } from "~/shared/stores/environment-store";
import { onAppForeground } from "~/shared/utils/app-lifecycle";

import type { PageForceUpdateFieldsFragment } from "@repo/cms/lib/__generated/sdk";

const FIVE_MINUTES = 5 * 60 * 1000;

export type ForceUpdateGateStatus = "checking" | "allowed" | "gated";

export interface ForceUpdateGateResult {
  /** `checking` until the first decision is safe to render. */
  status: ForceUpdateGateStatus;
  gated: boolean;
  /** Cached-or-fresh gate config, or `null` when none applies. */
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
    networkMode: "always",
    meta: { suppressToast: true },
  });

  // Re-check on resume (fresh cache skips the network).
  useEffect(() => {
    if (!envLoaded) return;
    return onAppForeground(() => {
      void queryClient.fetchQuery({
        queryKey,
        queryFn: () => fetchForceUpdate(locale),
        staleTime: FIVE_MINUTES,
        gcTime: Infinity,
        networkMode: "always",
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
  const running = Application.nativeApplicationVersion ?? "0.0.0";
  const active = gate?.active === true;
  const effective = !gate?.effectiveAt || new Date(gate.effectiveAt) <= new Date();
  const below = gate?.minVersion ? isVersionBelow(running, gate.minVersion) : false;
  const gated = Boolean(active && effective && below);
  const status: ForceUpdateGateStatus = initialCheckReady
    ? gated
      ? "gated"
      : "allowed"
    : "checking";

  return { status, gated: status === "gated", gate };
}
