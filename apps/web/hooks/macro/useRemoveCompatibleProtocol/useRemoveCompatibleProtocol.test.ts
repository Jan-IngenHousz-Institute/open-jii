import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { MacroProtocolList } from "@repo/api/domains/macro/macro.schema";

import { useRemoveCompatibleProtocol } from "./useRemoveCompatibleProtocol";

describe("useRemoveCompatibleProtocol", () => {
  it("sends delete request with correct params", async () => {
    const spy = server.mount(contract.macros.removeCompatibleProtocol);

    const { result } = renderHook(() => useRemoveCompatibleProtocol("macro-1"));

    act(() => {
      result.current.mutate({
        id: "macro-1",
        protocolId: "p-1",
      });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("macro-1");
      expect(spy.params.protocolId).toBe("p-1");
    });
  });

  it("completes mutation successfully", async () => {
    server.mount(contract.macros.removeCompatibleProtocol);

    const { result } = renderHook(() => useRemoveCompatibleProtocol("macro-1"));

    act(() => {
      result.current.mutate({
        id: "macro-1",
        protocolId: "p-1",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("drops the protocol before the server answers and puts it back when removal fails", async () => {
    const listKey = orpc.macros.listCompatibleProtocols.queryKey({ input: { id: "macro-1" } });
    // The seeded list has no observer, so it must outlive the default zero gcTime.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
    });
    const entry = (id: string): MacroProtocolList[number] => ({
      macroId: "macro-1",
      protocol: { id, name: id, family: "multispeq", createdBy: "user-1" },
      addedAt: "2026-01-01T00:00:00.000Z",
    });
    queryClient.setQueryData(listKey, [entry("p-1"), entry("p-2")]);
    server.mount(contract.macros.removeCompatibleProtocol, { status: 500, delay: 200 });
    const listedIds = () =>
      queryClient.getQueryData<MacroProtocolList>(listKey)?.map((listed) => listed.protocol.id);

    const { result } = renderHook(() => useRemoveCompatibleProtocol("macro-1"), { queryClient });
    act(() => {
      result.current.mutate({ id: "macro-1", protocolId: "p-1" });
    });

    await waitFor(() => expect(listedIds()).toEqual(["p-2"]));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(listedIds()).toEqual(["p-1", "p-2"]);
  });

  it.each([200, 500])(
    "invalidates every protocol and macro list after status %s",
    async (status) => {
      server.mount(contract.macros.removeCompatibleProtocol, { status, body: [] });
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
      const { result } = renderHook(() => useRemoveCompatibleProtocol("macro-1"), { queryClient });

      act(() => {
        result.current.mutate({ id: "macro-1", protocolId: "protocol-1" });
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
