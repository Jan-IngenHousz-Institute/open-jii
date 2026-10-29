import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useSession } from "~/features/auth/hooks/use-session";
import { teardownFlow } from "~/features/measurement-flow/services/flow-actions";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useFlowSnapshotsStore } from "~/features/measurement-flow/stores/use-flow-snapshots-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { ConfiguredQueryClientProvider } from "~/shared/ui/configured-query-client-provider";

const OWNER_KEY = "openjii_selection_owner";
const LEGACY_CACHE_KEY = "REACT_QUERY_OFFLINE_CACHE_v4";
const MAX_ATTEMPTS = 3;

let preparation: Promise<void> = Promise.resolve();

export function prepareIdentitySelections(identity: string, isResearcher = false) {
  preparation = preparation
    .catch(() => undefined)
    .then(() => clearPreviousSelections(identity, isResearcher));
  return preparation;
}

// The pre-update cache has no owner key. Its only record of whose it is: the profile query the
// old build fetched for the signed-in user and dropped at sign-out.
function legacyCacheOwner(raw: string) {
  try {
    const queries = (JSON.parse(raw) as { clientState?: { queries?: unknown[] } }).clientState
      ?.queries;
    const owners = new Set<unknown>();
    for (const query of queries ?? []) {
      const { queryKey, state } = query as {
        queryKey?: [unknown, { input?: { id?: unknown } }?];
        state?: { data?: unknown };
      };
      const [path, options] = queryKey ?? [];
      if (Array.isArray(path) && path.join("/") === "users/getUserProfile" && state?.data != null)
        owners.add(options?.input?.id);
    }
    const [owner] = owners;
    return owners.size === 1 && typeof owner === "string" ? owner : undefined;
  } catch {
    return undefined;
  }
}

async function clearPreviousSelections(identity: string, isResearcher: boolean) {
  const previous = await AsyncStorage.getItem(OWNER_KEY);
  if (previous === identity) return;
  // Before identity-scoped caches there was one cache and no owner marker. It survives the
  // update only for the researcher it provably belongs to; anyone else starts clean.
  if (previous === null) {
    const legacy = await AsyncStorage.getItem(LEGACY_CACHE_KEY);
    if (legacy !== null && isResearcher && legacyCacheOwner(legacy) === identity) {
      const scoped = `${LEGACY_CACHE_KEY}:${identity}`;
      if ((await AsyncStorage.getItem(scoped)) === null) await AsyncStorage.setItem(scoped, legacy);
      await AsyncStorage.removeItem(LEGACY_CACHE_KEY);
      await AsyncStorage.setItem(OWNER_KEY, identity);
      return;
    }
  }
  // Finish hydration before clearing, so an old disk read cannot restore a selection.
  await Promise.all([
    useMeasurementFlowStore.persist.rehydrate(),
    useFlowAnswersStore.persist.rehydrate(),
    useFlowSnapshotsStore.persist.rehydrate(),
  ]);
  teardownFlow();
  await AsyncStorage.removeItem(LEGACY_CACHE_KEY);
  if (previous !== null) await AsyncStorage.removeItem(`${LEGACY_CACHE_KEY}:${previous}`);
  await AsyncStorage.setItem(OWNER_KEY, identity);
}

export function IdentityQueryProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useSession();
  const identity = user?.id ?? "signed-out";
  const isResearcher = !!user && !user.isAnonymous;
  const [ready, setReady] = useState<string>();
  const [attempt, setAttempt] = useState({ identity, count: 0 });
  const attempts = attempt.identity === identity ? attempt.count : 0;
  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void prepareIdentitySelections(identity, isResearcher)
      .then(() => {
        if (active) setReady(identity);
      })
      .catch(() => {
        if (!active) return;
        if (attempts + 1 < MAX_ATTEMPTS) {
          timer = setTimeout(() => setAttempt({ identity, count: attempts + 1 }), 1_000);
          return;
        }
        // Storage keeps failing: drop the selections in memory and open with this identity's
        // own scoped cache rather than a blank screen.
        teardownFlow();
        setReady(identity);
      });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [identity, isResearcher, isLoaded, attempts]);
  if (!isLoaded || ready !== identity) return null;
  return (
    <ConfiguredQueryClientProvider key={identity} identity={identity}>
      {children}
    </ConfiguredQueryClientProvider>
  );
}
