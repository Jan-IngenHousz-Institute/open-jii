import { createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { usePeopleSearch } from "./use-people-search";

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

const viewer = { ...createUserProfile({ userId: "viewer", email: null }), matchedEmail: true };
const other = { ...createUserProfile({ userId: "other", email: null }), matchedEmail: true };

async function searchFor(term: string) {
  const { result } = renderHook(() => usePeopleSearch({ kind: "global" }));
  act(() => result.current.setTerm(term));
  await waitFor(() => expect(result.current.status.isLoading).toBe(false));
  await waitFor(() => expect(result.current.people).not.toHaveLength(0));
  return result.current;
}

describe("usePeopleSearch", () => {
  afterEach(() => mockSession(null));

  it("calls a complete address its viewer's own when only the viewer answers to it", async () => {
    mockSession({ id: "viewer" });
    server.mount(contract.users.searchUsers, { body: [viewer] });

    expect((await searchFor("me@uni.edu")).status.isOwnAddress).toBe(true);
  });

  it("does not when someone else answers to the address", async () => {
    mockSession({ id: "viewer" });
    server.mount(contract.users.searchUsers, { body: [other] });

    expect((await searchFor("them@uni.edu")).status.isOwnAddress).toBe(false);
  });

  it("does not for a name that finds only the viewer", async () => {
    mockSession({ id: "viewer" });
    server.mount(contract.users.searchUsers, { body: [{ ...viewer, matchedEmail: false }] });

    expect((await searchFor("Vera")).status.isOwnAddress).toBe(false);
  });
});
