import { describe, expect, it, vi } from "vitest";
import { syncSessionFromServer } from "~/features/auth/services/session-reload";

interface User {
  id: string;
  registered: boolean;
}

// A stand-in for Better Auth's session atom: each refetch applies the next queued outcome,
// where null is a fetch another fetch cancelled before it could write anything.
function fakeClient(initial: User, server: User | null, refetchOutcomes: (User | null)[]) {
  let state: { data: { user: User } | null } = { data: { user: initial } };
  const refetch = vi.fn(() => {
    const next = refetchOutcomes.shift();
    if (next) state = { data: { user: next } };
    return Promise.resolve();
  });
  const getSession = vi.fn(() =>
    Promise.resolve(
      server ? { data: { user: server }, error: null } : { data: null, error: { status: 500 } },
    ),
  );
  const client = {
    getSession,
    $store: { atoms: { session: { get: () => ({ ...state, refetch }) } } },
  };
  return { client: client as never, getSession, refetch };
}

const unregistered = { id: "u1", registered: false };
const registered = { id: "u1", registered: true };

describe("syncSessionFromServer", () => {
  it("asks the server past the cookie cache", async () => {
    const { client, getSession } = fakeClient(registered, registered, []);

    await syncSessionFromServer(client);

    expect(getSession).toHaveBeenCalledWith({ query: { disableCookieCache: true } });
  });

  it("keeps fetching when the store's fetch is cancelled by the cookie-change refetch", async () => {
    const { client, refetch } = fakeClient(unregistered, registered, [null, registered]);

    await expect(syncSessionFromServer(client)).resolves.toEqual(registered);
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("does not fetch again once the store already agrees", async () => {
    const { client, refetch } = fakeClient(registered, registered, []);

    await expect(syncSessionFromServer(client)).resolves.toEqual(registered);
    expect(refetch).not.toHaveBeenCalled();
  });

  it("reports the store's view when it never catches up", async () => {
    const { client, refetch } = fakeClient(unregistered, registered, [null, null, null]);

    await expect(syncSessionFromServer(client)).resolves.toEqual(unregistered);
    expect(refetch).toHaveBeenCalledTimes(3);
  });

  it("returns null when the server cannot be read", async () => {
    const { client, refetch } = fakeClient(unregistered, null, []);

    await expect(syncSessionFromServer(client)).resolves.toBeNull();
    expect(refetch).not.toHaveBeenCalled();
  });
});
