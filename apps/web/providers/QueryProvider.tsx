"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { tsr } from "../lib/tsr";

const queryClient = new QueryClient();

export async function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <tsr.ReactQueryProvider>{children}</tsr.ReactQueryProvider>
    </QueryClientProvider>
  );
}
