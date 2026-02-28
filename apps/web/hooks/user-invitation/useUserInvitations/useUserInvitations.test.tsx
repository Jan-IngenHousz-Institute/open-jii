import { createInvitation } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useUserInvitations } from "./useUserInvitations";

describe("useUserInvitations", () => {
  it("returns invitations on success", async () => {
    const invitations = [
      createInvitation({ email: "user1@example.com", role: "member" }),
      createInvitation({ email: "user2@example.com", role: "admin" }),
    ];

    server.mount(contract.users.listInvitations, { body: invitations });

    const { result } = renderHook(() => useUserInvitations("experiment", "exp-123"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.body).toHaveLength(2);
    expect(result.current.data?.body[0]?.email).toBe("user1@example.com");
    expect(result.current.data?.body[1]?.role).toBe("admin");
  });

  it("passes correct query params", async () => {
    const spy = server.mount(contract.users.listInvitations, { body: [] });

    const { result } = renderHook(() => useUserInvitations("experiment", "exp-123"));

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });

    expect(spy.query).toMatchObject({
      resourceType: "experiment",
      resourceId: "exp-123",
    });
  });

  it("starts in loading state", () => {
    server.mount(contract.users.listInvitations, { body: [], delay: 200 });

    const { result } = renderHook(() => useUserInvitations("experiment", "exp-456"));

    expect(result.current.isLoading).toBe(true);
  });

  it("handles error response", async () => {
    server.mount(contract.users.listInvitations, { status: 403 });

    const { result } = renderHook(() => useUserInvitations("experiment", "exp-789"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
  });
});
