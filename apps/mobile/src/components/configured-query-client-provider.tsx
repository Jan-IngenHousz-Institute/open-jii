import { QueryClient, QueryCache, QueryClientProvider } from "@tanstack/react-query";
import React, { useRef, useState } from "react";
import { Toast } from "~/components/Toast";

const defaultOptions = {
  queries: {
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  },
};

export function ConfiguredQueryClientProvider({ children }) {
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "error" as "success" | "error" | "info" | "warning",
  });

  const queryClientRef = useRef<QueryClient>(undefined);
  if (!queryClientRef.current) {
    const queryCache = new QueryCache({
      onError: (error: any) => {
        const message = error?.body?.message ?? error?.message ?? "Something went wrong";
        console.log("showing error", message);

        setToast({
          visible: true,
          message,
          type: "error",
        });
      },
    });

    queryClientRef.current = new QueryClient({
      queryCache,
      defaultOptions,
    });
  }

  return (
    <>
      <QueryClientProvider client={queryClientRef.current}>{children}</QueryClientProvider>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast({ ...toast, visible: false })}
        duration={10000}
      />
    </>
  );
}
