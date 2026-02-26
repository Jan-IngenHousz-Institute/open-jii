/**
 * useExperimentMemberRoleUpdate hook test — MSW-based.
 *
 * The real hook calls `tsr.experiments.updateExperimentMemberRole.useMutation` →
 * `PATCH /api/v1/experiments/:id/members/:memberId`. MSW intercepts that request.
 */
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useExperimentMemberRoleUpdate } from "./useExperimentMemberRoleUpdate";

describe("useExperimentMemberRoleUpdate", () => {
  it("sends PATCH request via MSW", async () => {
    const spy = server.mount(contract.experiments.updateExperimentMemberRole, {
      body: { success: true },
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
      body: { success: true },
    });

    const { result } = renderHook(() => useExperimentMemberRoleUpdate());

    act(() => {
      result.current.mutate({
        params: { id: "exp-1", memberId: "user-2" },
        body: { role: "viewer" },
      });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("exp-1");
      expect(spy.params.memberId).toBe("user-2");
      expect(spy.body).toMatchObject({ role: "viewer" });
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
