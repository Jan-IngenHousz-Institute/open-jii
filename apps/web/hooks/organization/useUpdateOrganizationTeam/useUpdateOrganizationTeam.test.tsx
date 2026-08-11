import { createTestQueryClient, renderHook } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authClient } from "@repo/auth/client";

import { useUpdateOrganizationTeam } from "./useUpdateOrganizationTeam";

const updateTeam = () => vi.mocked(authClient.organization.updateTeam);

/**
 * Better Auth resolves this endpoint's target as `body.data.organizationId`, falling
 * back to the session's active organization. Nothing in this product ever sets one, so
 * omitting the id does not pick a sensible default — every rename fails with
 * `NO_ACTIVE_ORGANIZATION`. It is also the only team endpoint that reads the id from
 * inside `data` rather than from the top level, which is how it came to be the one
 * team hook that omitted it.
 */
describe("useUpdateOrganizationTeam", () => {
  afterEach(() => {
    updateTeam().mockResolvedValue({ data: null, error: null });
  });

  it("carries the organization id inside data, where this endpoint looks for it", async () => {
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useUpdateOrganizationTeam("org-1"), { queryClient });
    await result.current.mutateAsync({ teamId: "team-1", name: "Imaging" });

    expect(updateTeam()).toHaveBeenCalledWith({
      teamId: "team-1",
      data: { name: "Imaging", organizationId: "org-1" },
    });
  });

  it("rejects with the server's refusal rather than resolving quietly", async () => {
    updateTeam().mockResolvedValue({
      data: null,
      error: { message: "No active organization" },
    });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useUpdateOrganizationTeam("org-1"), { queryClient });

    await expect(result.current.mutateAsync({ teamId: "team-1", name: "Imaging" })).rejects.toThrow(
      /No active organization/,
    );
  });
});
