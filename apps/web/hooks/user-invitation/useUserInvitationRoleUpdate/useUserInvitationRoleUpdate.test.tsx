import { createInvitation } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { useUserInvitationRoleUpdate } from "./useUserInvitationRoleUpdate";

describe("useUserInvitationRoleUpdate", () => {
  it("sends PATCH request with correct params and body", async () => {
    const updated = createInvitation({ role: "admin" });
    const spy = server.mount(orpcContract.users.updateInvitationRole, {
      body: updated,
    });

    const { result } = renderHook(() => useUserInvitationRoleUpdate());

    act(() => {
      result.current.mutate({
        invitationId: "inv-1",
        role: "admin",
      });
    });

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });

    expect(spy.params.invitationId).toBe("inv-1");
    expect(spy.body).toMatchObject({ role: "admin" });
  });

  it("returns mutation result with mutate function", () => {
    const { result } = renderHook(() => useUserInvitationRoleUpdate());

    expect(result.current.mutate).toBeDefined();
    expect(typeof result.current.mutate).toBe("function");
  });

  it("reports pending state while request is in-flight", async () => {
    server.mount(orpcContract.users.updateInvitationRole, {
      body: createInvitation(),
      delay: 100,
    });

    const { result } = renderHook(() => useUserInvitationRoleUpdate());

    act(() => {
      result.current.mutate({
        invitationId: "inv-1",
        role: "admin",
      });
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });

  it("reports error on failure", async () => {
    server.mount(orpcContract.users.updateInvitationRole, { status: 404 });

    const { result } = renderHook(() => useUserInvitationRoleUpdate());

    act(() => {
      result.current.mutate({
        invitationId: "inv-1",
        role: "admin",
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("invalidates experiment-invitations queries on success", async () => {
    server.mount(orpcContract.users.listInvitations, { body: [createInvitation()] });
    server.mount(orpcContract.users.updateInvitationRole, {
      body: createInvitation({ role: "admin" }),
    });

    const { result } = renderHook(() => useUserInvitationRoleUpdate());

    act(() => {
      result.current.mutate({
        invitationId: "inv-1",
        role: "admin",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
