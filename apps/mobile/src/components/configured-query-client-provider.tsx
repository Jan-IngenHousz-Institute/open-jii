import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, QueryCache, onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import axios from "axios";
import React, { useEffect, useRef } from "react";
import { toast } from "sonner-native";

const PING_URL = "https://clients3.google.com/generate_204";
const CHECK_INTERVAL = 10 * 1000;

function startConnectivityWatcher() {
  let lastOnline = true;

  async function checkOnline() {
    try {
      await axios.head(PING_URL, { timeout: 3000 });
      if (!lastOnline) {
        lastOnline = true;
        onlineManager.setOnline(true);
      }
    } catch {
      if (lastOnline) {
        lastOnline = false;
        onlineManager.setOnline(false);
      }
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
