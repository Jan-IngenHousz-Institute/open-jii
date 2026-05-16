import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentMemberRoleUpdate } from "./useExperimentMemberRoleUpdate";

const memberResponse = {
  user: {
    id: "user-1",
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
  },
  role: "admin" as const,
  joinedAt: "2025-01-01T00:00:00.000Z",
};

describe("useExperimentMemberRoleUpdate", () => {
  it("sends PATCH request", async () => {
    const spy = server.mount(contract.experiments.updateExperimentMemberRole, {
      body: memberResponse,
    });

    const { result } = renderHook(() => useExperimentMemberRoleUpdate());

    act(() => {
      result.current.mutate({
        params: { id: "exp-1", memberId: "user-1" },
        body: { role: "admin" },
      });
    });

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
  });

  it("sends the correct params and body", async () => {
    const spy = server.mount(contract.experiments.updateExperimentMemberRole, {
      body: memberResponse,
    });

    const { result } = renderHook(() => useExperimentMemberRoleUpdate());

    act(() => {
      result.current.mutate({
        params: { id: "exp-1", memberId: "user-2" },
        body: { role: "member" },
      });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("exp-1");
      expect(spy.params.memberId).toBe("user-2");
      expect(spy.body).toMatchObject({ role: "member" });
    });
  });

  it("handles error response", async () => {
    server.mount(contract.experiments.updateExperimentMemberRole, { status: 500 });

    const { result } = renderHook(() => useExperimentMemberRoleUpdate());

    act(() => {
      result.current.mutate({
        params: { id: "exp-1", memberId: "user-1" },
        body: { role: "admin" },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
