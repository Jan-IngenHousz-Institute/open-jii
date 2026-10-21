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

let preparation: Promise<void> = Promise.resolve();

export function prepareIdentitySelections(identity: string) {
  preparation = preparation.catch(() => undefined).then(() => clearPreviousSelections(identity));
  return preparation;
}

async function clearPreviousSelections(identity: string) {
  const previous = await AsyncStorage.getItem(OWNER_KEY);
  if (previous === identity) return;
  // Finish hydration before clearing, so an old disk read cannot restore a selection.
  await Promise.all([
    useMeasurementFlowStore.persist.rehydrate(),
    useFlowAnswersStore.persist.rehydrate(),
    useFlowSnapshotsStore.persist.rehydrate(),
  ]);
  teardownFlow();
  await AsyncStorage.removeItem("REACT_QUERY_OFFLINE_CACHE_v4");
  if (previous) await AsyncStorage.removeItem(`REACT_QUERY_OFFLINE_CACHE_v4:${previous}`);
  await AsyncStorage.setItem(OWNER_KEY, identity);
}

export function IdentityQueryProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useSession();
  const identity = user?.id ?? "signed-out";
  const [ready, setReady] = useState<string>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void prepareIdentitySelections(identity)
      .then(() => {
        if (active) setReady(identity);
      })
      .catch(() => {
        if (active) timer = setTimeout(() => setRetry((n) => n + 1), 1_000);
      });
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [identity, isLoaded, retry]);
  if (!isLoaded || ready !== identity) return null;
  return (
    <ConfiguredQueryClientProvider key={identity} identity={identity}>
      {children}
    </ConfiguredQueryClientProvider>
  );
}
