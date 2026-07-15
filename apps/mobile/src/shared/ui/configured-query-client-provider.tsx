import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, QueryCache, onlineManager, focusManager } from "@tanstack/react-query";
import {
  PersistQueryClientProvider,
  removeOldestQuery,
} from "@tanstack/react-query-persist-client";
import React, { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { toast } from "sonner-native";
import { isOnline } from "~/shared/device/is-online";
import { i18n } from "~/shared/i18n";
import { createLogger } from "~/shared/observability/logger";
import { shouldPersistQuery } from "~/shared/ui/persist-query-filter";

const log = createLogger("query-client");

const CHECK_INTERVAL = 10 * 1000;

// Start as offline until the first connectivity check confirms otherwise.
// Must run at module level (before any render) so the session guard in
// the tabs layout doesn't assume online on cold start.
onlineManager.setOnline(false);

// RN has no window focus events, so point focusManager at AppState: "focus"
// means the app returning to the foreground (edge-triggered, so boot-time
// flaps don't trigger refetch storms). Symmetric with onlineManager above.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener("change", (state) => {
    handleFocus(state === "active");
  });
  return () => sub.remove();
});

function startConnectivityWatcher() {
  let lastOnline = false;

  async function checkOnline() {
    const online = await isOnline();
    if (online && !lastOnline) {
      lastOnline = true;
      onlineManager.setOnline(true);
    } else if (!online && lastOnline) {
      lastOnline = false;
      onlineManager.setOnline(false);
    }
  }

  checkOnline(); // run immediately
  const id = setInterval(() => void checkOnline(), CHECK_INTERVAL);
  return () => clearInterval(id);
}

const defaultOptions = {
  queries: {
    staleTime: 0,
    gcTime: Infinity,
    networkMode: "offlineFirst" as const,
    refetchOnMount: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: 1,
  },
};

// New key so the fixed build never reads the old unbounded blob (that read is
// the importArray OOM). retry sheds the oldest query if a write fails.
const OFFLINE_CACHE_KEY = "REACT_QUERY_OFFLINE_CACHE_v4";

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: OFFLINE_CACHE_KEY,
  retry: removeOldestQuery,
});

void AsyncStorage.removeItem("REACT_QUERY_OFFLINE_CACHE").catch((err) => {
  log.warn("failed to drop legacy query cache", { err: (err as Error)?.message });
});

export function ConfiguredQueryClientProvider({ children }) {
  const queryClientRef = useRef<QueryClient>(undefined);

  useEffect(() => {
    const stop = startConnectivityWatcher();
    return stop;
  }, []);

  if (!queryClientRef.current) {
    const queryCache = new QueryCache({
      onError: (error: any, query) => {
        const bodyMessage = error?.body?.message;
        // Always log the raw error so observability sees it even when the
        // API's own message is what the user gets toasted.
        log.warn("query error", {
          message: error?.message,
          body_message: bodyMessage,
          status: error?.status,
        });
        // Don't toast connection failures. A network/timeout error never got an
        // HTTP response, so it has no status; that's the reliable signal because
        // onlineManager lags a fast wifi-off. The cached UI stays usable.
        if (!onlineManager.isOnline() || error?.status == null) return;
        // Queries that gracefully fall back (e.g. user profile) opt out of the
        // global toast via meta.suppressToast so a 404 doesn't blare at the user.
        if (query.meta?.suppressToast) return;
        toast.error(bodyMessage ?? i18n.t("common:errorGeneric"));
      },
    });

    queryClientRef.current = new QueryClient({
      queryCache,
      defaultOptions,
    });
  }

  return (
    <PersistQueryClientProvider
      client={queryClientRef.current}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: Infinity,
        // Bump when a query's stored shape changes (e.g. useQuery to
        // useInfiniteQuery). On mismatch the persisted cache is dropped, so
        // hydrating code doesn't see an old shape and crash.
        buster: "v3-workbook-version-cache",
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
