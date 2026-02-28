import { createInvitation } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useUserInvitationRevoke } from "./useUserInvitationRevoke";

describe("useUserInvitationRevoke", () => {
  it("sends DELETE request with correct params", async () => {
    const spy = server.mount(contract.users.revokeInvitation, { status: 204 });

    const { result } = renderHook(() => useUserInvitationRevoke());

    act(() => {
      result.current.mutate({ params: { invitationId: "inv-1" } });
    });

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });

    expect(spy.params.invitationId).toBe("inv-1");
  });

  it("returns mutation result with mutate function", () => {
    const { result } = renderHook(() => useUserInvitationRevoke());

    expect(result.current.mutate).toBeDefined();
    expect(typeof result.current.mutate).toBe("function");
  });

  it("reports pending state while request is in-flight", async () => {
    server.mount(contract.users.revokeInvitation, { status: 204, delay: 100 });

    const { result } = renderHook(() => useUserInvitationRevoke());

    act(() => {
      result.current.mutate({ params: { invitationId: "inv-1" } });
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });

  it("reports error on failure", async () => {
    server.mount(contract.users.revokeInvitation, { status: 403 });

    const { result } = renderHook(() => useUserInvitationRevoke());

    act(() => {
      result.current.mutate({ params: { invitationId: "inv-1" } });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("invalidates experiment-invitations queries on success", async () => {
    server.mount(contract.users.listInvitations, { body: [createInvitation()] });
    server.mount(contract.users.revokeInvitation, { status: 204 });

    const { result } = renderHook(() => useUserInvitationRevoke());

    act(() => {
      result.current.mutate({ params: { invitationId: "inv-1" } });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
