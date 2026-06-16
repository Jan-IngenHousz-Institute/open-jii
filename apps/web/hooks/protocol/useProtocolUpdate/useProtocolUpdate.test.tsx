import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useProtocolUpdate } from "./useProtocolUpdate";

describe("useProtocolUpdate", () => {
  it("sends an update request and calls onSuccess with the updated protocol", async () => {
    const updated = createProtocol({ id: "p-1", name: "Updated" });
    const spy = server.mount(contract.protocols.updateProtocol, { body: updated });

    let successData: unknown = null;
    const { result } = renderHook(() =>
      useProtocolUpdate("p-1", {
        onSuccess: (protocol) => {
          successData = protocol;
        },
      }),
    );

    act(() => {
      result.current.mutate({ params: { id: "p-1" }, body: { name: "Updated" } });
    });

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls[0].params).toEqual({ id: "p-1" });
    expect(spy.calls[0].body).toMatchObject({ name: "Updated" });
    await waitFor(() => expect(successData).not.toBeNull());
    expect(successData).toMatchObject({ id: "p-1", name: "Updated" });
  });

  it("surfaces a server error", async () => {
    server.mount(contract.protocols.updateProtocol, { status: 500 });

    const { result } = renderHook(() => useProtocolUpdate("p-1"));

    act(() => {
      result.current.mutate({ params: { id: "p-1" }, body: { name: "Will Fail" } });
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});
