import { resourceCacheKeys } from "@/hooks/sharing/resource-cache-keys";
import { createResourceGrant } from "@/test/factories";
import { server } from "@/test/msw/server";
import { createTestQueryClient, renderHook } from "@/test/test-utils";
import type { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { useCollaboratorRoleUpdate } from "./useCollaboratorRoleUpdate";

const SELF_ID = "user-self";

/** Point the globally-mocked `useSession` at a given principal. */
function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

/**
 * Whether every cache the mounted experiment view reads from has been marked
 * stale — the signal that its capabilities will be re-resolved from the server.
 */
function experimentCachesInvalidated(queryClient: QueryClient): boolean[] {
  return resourceCacheKeys("experiment", "exp-1").map(
    (queryKey) => queryClient.getQueryState(queryKey)?.isInvalidated ?? false,
  );
}

function seedExperimentCaches(queryClient: QueryClient) {
  for (const queryKey of resourceCacheKeys("experiment", "exp-1")) {
    queryClient.setQueryData(queryKey, { stale: "capabilities" });
  }
}

describe("useCollaboratorRoleUpdate", () => {
  afterEach(() => {
    // Restore the suite-wide default (signed out, session resolved).
    mockSession(null);
  });

  it("re-resolves the resource's own caches when the caller retiers their own grant", async () => {
    mockSession({ id: SELF_ID });
    const retiered = createResourceGrant({
      id: "grant-self",
      granteeId: SELF_ID,
      resourceId: "exp-1",
      role: "viewer",
    });
    server.mount(contract.sharing.updateGrant, { body: [retiered] });

    const queryClient = createTestQueryClient();
    seedExperimentCaches(queryClient);

    const { result } = renderHook(() => useCollaboratorRoleUpdate(), { queryClient });
    await result.current.mutateAsync({
      resourceType: "experiment",
      id: "exp-1",
      grantId: "grant-self",
      role: "viewer",
    });

    // "Can edit" → "Can view" drops `share` and `manage`, so the tabs, the invite
    // action and the row controls all have to go — which only happens once the
    // access response is re-read.
    expect(experimentCachesInvalidated(queryClient)).toEqual([true, true, true]);
  });

  it("leaves them alone when somebody else's grant is retiered", async () => {
    mockSession({ id: SELF_ID });
    const other = createResourceGrant({
      id: "grant-other",
      granteeId: "user-other",
      resourceId: "exp-1",
      role: "viewer",
    });
    server.mount(contract.sharing.updateGrant, { body: [other] });

    const queryClient = createTestQueryClient();
    seedExperimentCaches(queryClient);

    const { result } = renderHook(() => useCollaboratorRoleUpdate(), { queryClient });
    await result.current.mutateAsync({
      resourceType: "experiment",
      id: "exp-1",
      grantId: "grant-other",
      role: "viewer",
    });

    // The caller's own access did not move, so the page they are on is still
    // backed by exactly the capabilities it was rendered from.
    expect(experimentCachesInvalidated(queryClient)).toEqual([false, false, false]);
  });
});
