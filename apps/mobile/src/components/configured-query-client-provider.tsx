import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, QueryCache } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import React, { useRef } from "react";
import { useToast } from "~/context/toast-context";

const defaultOptions = {
  queries: {
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: 1,
  },
};

export function ConfiguredQueryClientProvider({ children }) {
  const { showToast } = useToast();

  const queryClientRef = useRef<QueryClient>(undefined);
  const persistorRef = useRef<any>(undefined);

  if (!queryClientRef.current) {
    const queryCache = new QueryCache({
      onError: (error: any) => {
        const message = error?.body?.message ?? error?.message ?? "Something went wrong";
        showToast(message, "error");
      },
    });

    queryClientRef.current = new QueryClient({
      queryCache,
      defaultOptions,
    });

    persistorRef.current = createAsyncStoragePersister({
      storage: AsyncStorage,
    });
  }

  return (
    <PersistQueryClientProvider
      client={queryClientRef.current}
      persistOptions={{ persister: persistorRef.current }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
