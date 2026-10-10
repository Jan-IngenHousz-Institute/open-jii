import { orpc } from "@/lib/orpc";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { ProtocolMacroList } from "@repo/api/domains/protocol/protocol.schema";

import { useRemoveCompatibleMacro } from "./useRemoveCompatibleMacro";

describe("useRemoveCompatibleMacro", () => {
  it("sends delete request with correct params", async () => {
    const spy = server.mount(contract.protocols.removeCompatibleMacro);

    const { result } = renderHook(() => useRemoveCompatibleMacro("protocol-1"));

    act(() => {
      result.current.mutate({
        id: "protocol-1",
        macroId: "m-1",
      });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("protocol-1");
      expect(spy.params.macroId).toBe("m-1");
    });
  });

  it("completes mutation successfully", async () => {
    server.mount(contract.protocols.removeCompatibleMacro);

    const { result } = renderHook(() => useRemoveCompatibleMacro("protocol-1"));

    act(() => {
      result.current.mutate({
        id: "protocol-1",
        macroId: "m-1",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("drops the macro before the server answers and puts it back when removal fails", async () => {
    const listKey = orpc.protocols.listCompatibleMacros.queryKey({ input: { id: "protocol-1" } });
    // The seeded list has no observer, so it must outlive the default zero gcTime.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
    });
    const entry = (id: string): ProtocolMacroList[number] => ({
      protocolId: "protocol-1",
      macro: { id, name: id, filename: `${id}.py`, language: "python", createdBy: "user-1" },
      addedAt: "2026-01-01T00:00:00.000Z",
    });
    queryClient.setQueryData(listKey, [entry("m-1"), entry("m-2")]);
    server.mount(contract.protocols.removeCompatibleMacro, { status: 500, delay: 200 });
    const listedIds = () =>
      queryClient.getQueryData<ProtocolMacroList>(listKey)?.map((listed) => listed.macro.id);

    const { result } = renderHook(() => useRemoveCompatibleMacro("protocol-1"), { queryClient });
    act(() => {
      result.current.mutate({ id: "protocol-1", macroId: "m-1" });
    });

    await waitFor(() => expect(listedIds()).toEqual(["m-2"]));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(listedIds()).toEqual(["m-1", "m-2"]);
  });
});
