import { createInvitation } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useUserInvitationCreate } from "./useUserInvitationCreate";

describe("useUserInvitationCreate", () => {
  it("sends POST request with correct body", async () => {
    const invitation = createInvitation();
    const spy = server.mount(contract.users.createInvitation, {
      body: invitation,
    });

    const { result } = renderHook(() => useUserInvitationCreate());

    act(() => {
      result.current.mutate({
        body: {
          resourceType: "experiment",
          resourceId: "exp-1",
          email: "new@example.com",
          role: "member",
        },
      });
    });

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });

    expect(spy.body).toMatchObject({
      email: "new@example.com",
      resourceType: "experiment",
    });
  });

  it("returns mutation result with mutate function", () => {
    const { result } = renderHook(() => useUserInvitationCreate());

    expect(result.current.mutate).toBeDefined();
    expect(typeof result.current.mutate).toBe("function");
  });

  it("reports pending state while request is in-flight", async () => {
    server.mount(contract.users.createInvitation, {
      body: createInvitation(),
      delay: 100,
    });

    const { result } = renderHook(() => useUserInvitationCreate());

    act(() => {
      result.current.mutate({
        body: {
          resourceType: "experiment",
          resourceId: "exp-1",
          email: "new@example.com",
        },
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
    server.mount(contract.users.createInvitation, { status: 400 });

    const { result } = renderHook(() => useUserInvitationCreate());

    act(() => {
      result.current.mutate({
        body: {
          resourceType: "experiment",
          resourceId: "exp-1",
          email: "new@example.com",
        },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("invalidates experiment-invitations queries on success", async () => {
    server.mount(contract.users.listInvitations, { body: [createInvitation()] });
    server.mount(contract.users.createInvitation, { body: createInvitation() });

    const { result } = renderHook(() => useUserInvitationCreate());

    act(() => {
      result.current.mutate({
        body: {
          resourceType: "experiment",
          resourceId: "exp-1",
          email: "new@example.com",
        },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
