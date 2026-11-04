import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useUnsubscribeEmailByToken } from "./useUnsubscribeEmailByToken";

describe("useUnsubscribeEmailByToken", () => {
  it("posts the token in the path and returns the category", async () => {
    const spy = server.mount(contract.notifications.unsubscribeEmailByToken, {
      body: { category: "requests_and_invitations" },
    });

    const { result } = renderHook(() => useUnsubscribeEmailByToken());
    act(() => {
      result.current.mutate({ token: "signed.token" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ category: "requests_and_invitations" });
    expect(spy.callCount).toBe(1);
    expect(spy.params.token).toBe("signed.token");
  });

  it("reports a refused token as an error", async () => {
    server.mount(contract.notifications.unsubscribeEmailByToken, { status: 400 });

    const { result } = renderHook(() => useUnsubscribeEmailByToken());
    act(() => {
      result.current.mutate({ token: "altered.token" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
