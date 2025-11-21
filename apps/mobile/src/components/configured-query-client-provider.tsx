import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, QueryCache, onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import React, { useEffect, useRef } from "react";
import { toast } from "sonner-native";
import { isOnline } from "~/utils/is-online";

const CHECK_INTERVAL = 10 * 1000;

function startConnectivityWatcher() {
  let lastOnline = true;

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
    refetchOnMount: false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    retry: 1,
  },
};

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

export function ConfiguredQueryClientProvider({ children }) {
  const queryClientRef = useRef<QueryClient>(undefined);

  useEffect(() => {
    const stop = startConnectivityWatcher();
    return stop;
  }, []);

  if (!queryClientRef.current) {
    const queryCache = new QueryCache({
      onError: (error: any) => {
        console.log("error", error);
        const message = error?.body?.message ?? error?.message ?? "Something went wrong";
        toast.error(message);
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
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
