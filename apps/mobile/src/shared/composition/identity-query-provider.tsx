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

async function clearPreviousSelections(identity: string, isResearcher: boolean) {
  const previous = await AsyncStorage.getItem(OWNER_KEY);
  if (previous === identity) return;
  // Builds before identity-scoped caches kept one cache and no owner. It belongs to whoever is
  // still signed in, so a researcher keeps it, and their flow, through the update.
  if (previous === null) {
    const legacy = await AsyncStorage.getItem(LEGACY_CACHE_KEY);
    const scoped = `${LEGACY_CACHE_KEY}:${identity}`;
    if (legacy !== null && isResearcher && (await AsyncStorage.getItem(scoped)) === null)
      await AsyncStorage.setItem(scoped, legacy);
    await AsyncStorage.removeItem(LEGACY_CACHE_KEY);
    await AsyncStorage.setItem(OWNER_KEY, identity);
    return;
  }
  // Finish hydration before clearing, so an old disk read cannot restore a selection.
  await Promise.all([
    useMeasurementFlowStore.persist.rehydrate(),
    useFlowAnswersStore.persist.rehydrate(),
    useFlowSnapshotsStore.persist.rehydrate(),
  ]);
  teardownFlow();
  await AsyncStorage.removeItem(LEGACY_CACHE_KEY);
  await AsyncStorage.removeItem(`${LEGACY_CACHE_KEY}:${previous}`);
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
        // Storage keeps failing: drop the selections in memory and open on an empty cache
        // rather than a blank screen.
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
