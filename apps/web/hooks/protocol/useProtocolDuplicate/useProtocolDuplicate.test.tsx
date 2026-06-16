import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useProtocolDuplicate } from "./useProtocolDuplicate";

describe("useProtocolDuplicate", () => {
  it("posts a duplicate request and returns the forked protocol", async () => {
    const fork = createProtocol({ id: "p-2", name: "Copy of Original" });
    const spy = server.mount(contract.protocols.duplicateProtocol, { body: fork, status: 201 });

    const { result } = renderHook(() => useProtocolDuplicate());

    act(() => {
      result.current.mutate({ params: { id: "p-1" }, body: {} });
    });

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls[0].params).toEqual({ id: "p-1" });
    expect(result.current.data?.body).toMatchObject({ id: "p-2", name: "Copy of Original" });
  });

  it("surfaces a server error", async () => {
    server.mount(contract.protocols.duplicateProtocol, { status: 404 });

    const { result } = renderHook(() => useProtocolDuplicate());

    act(() => {
      result.current.mutate({ params: { id: "missing" }, body: {} });
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});
