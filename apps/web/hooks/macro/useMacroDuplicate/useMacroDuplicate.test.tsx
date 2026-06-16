import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useMacroDuplicate } from "./useMacroDuplicate";

describe("useMacroDuplicate", () => {
  it("posts a duplicate request and returns the forked macro", async () => {
    const fork = createMacro({ id: "m-2", name: "Copy of Original" });
    const spy = server.mount(contract.macros.duplicateMacro, { body: fork, status: 201 });

    const { result } = renderHook(() => useMacroDuplicate());

    act(() => {
      result.current.mutate({ params: { id: "m-1" }, body: {} });
    });

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.calls[0].params).toEqual({ id: "m-1" });
    expect(result.current.data?.body).toMatchObject({ id: "m-2", name: "Copy of Original" });
  });

  it("surfaces a server error", async () => {
    server.mount(contract.macros.duplicateMacro, { status: 404 });

    const { result } = renderHook(() => useMacroDuplicate());

    act(() => {
      result.current.mutate({ params: { id: "missing" }, body: {} });
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toMatchObject({ status: 404 });
  });
});
