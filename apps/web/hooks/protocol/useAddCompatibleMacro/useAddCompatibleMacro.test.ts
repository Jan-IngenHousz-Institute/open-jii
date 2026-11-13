import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useAddCompatibleMacro } from "./useAddCompatibleMacro";

describe("useAddCompatibleMacro", () => {
  it("sends add request with macro IDs", async () => {
    const spy = server.mount(contract.protocols.addCompatibleMacros, {
      body: [],
    });

    const { result } = renderHook(() => useAddCompatibleMacro("protocol-1"));

    act(() => {
      result.current.mutate({
        id: "protocol-1",
        macroIds: ["m-1", "m-2"],
      });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ macroIds: ["m-1", "m-2"] });
    });
  });

  it("completes mutation successfully", async () => {
    server.mount(contract.protocols.addCompatibleMacros, { body: [] });

    const { result } = renderHook(() => useAddCompatibleMacro("protocol-1"));

    act(() => {
      result.current.mutate({
        id: "protocol-1",
        macroIds: ["m-1"],
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it.each([200, 500])(
    "invalidates every protocol and macro list after status %s",
    async (status) => {
      server.mount(contract.protocols.addCompatibleMacros, { status, body: [] });
      const queryClient = new QueryClient({
        defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: false } },
      });
      const listKeys = [
        orpc.protocols.listProtocols.queryKey({ input: {} }),
        orpc.protocols.listProtocols.queryKey({ input: { page: 2, search: "leaf" } }),
        orpc.macros.listMacros.queryKey({ input: {} }),
        orpc.macros.listMacros.queryKey({ input: { page: 2, language: ["python"] } }),
      ];
      for (const key of listKeys) queryClient.setQueryData(key, []);
      const { result } = renderHook(() => useAddCompatibleMacro("protocol-1"), { queryClient });

      act(() => {
        result.current.mutate({ id: "protocol-1", macroIds: ["macro-1"] });
      });

      await waitFor(() =>
        expect(status === 200 ? result.current.isSuccess : result.current.isError).toBe(true),
      );
      for (const key of listKeys) {
        expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
      }
    },
  );
});
