import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { useMyJoinRequest } from "./useMyJoinRequest";

const joinRequest = {
  id: "11111111-1111-1111-1111-111111111111",
  experimentId: "22222222-2222-2222-2222-222222222222",
  user: {
    id: "33333333-3333-3333-3333-333333333333",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    avatarUrl: null,
  },
  message: "Please let me in",
  status: "pending" as const,
  decidedBy: null,
  decidedAt: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("useMyJoinRequest", () => {
  it("returns the pending request when one exists", async () => {
    server.mount(orpcContract.experiments.getMyJoinRequest, { body: joinRequest });

    const { result } = renderHook(() => useMyJoinRequest("exp-1"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(joinRequest.id);
  });

  it("does not surface a request when the API returns 404 (no pending request)", async () => {
    const spy = server.mount(orpcContract.experiments.getMyJoinRequest, { status: 404 });

    const { result } = renderHook(() => useMyJoinRequest("exp-1"));

    await waitFor(() => expect(result.current.isError).toBe(true));

    // 404 means "no pending request": data is absent, and the query is not
    // retried so the consumer can render the request-to-join UI immediately.
    expect(result.current.data).toBeUndefined();
    expect(spy.callCount).toBe(1);
  });

  it("does not fetch without an experiment id", () => {
    const spy = server.mount(orpcContract.experiments.getMyJoinRequest, { body: joinRequest });

    renderHook(() => useMyJoinRequest(""));

    expect(spy.called).toBe(false);
  });
});
