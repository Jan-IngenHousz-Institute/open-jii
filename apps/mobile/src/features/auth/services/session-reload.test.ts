import { describe, expect, it, vi } from "vitest";
import { syncSessionFromServer } from "~/features/auth/services/session-reload";

interface User {
  id: string;
  email?: string;
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

    expect(getSession).toHaveBeenCalledWith({
      query: { disableCookieCache: true },
      fetchOptions: { signal: expect.any(AbortSignal) },
    });
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

  it("updates an email change even when the registration flag has not changed", async () => {
    const previous = { ...unregistered, email: "0000-0002-1825-0097" };
    const updated = { ...unregistered, email: "ada@example.com" };
    const { client, refetch } = fakeClient(previous, updated, [updated]);

    await expect(syncSessionFromServer(client)).resolves.toEqual(updated);
    expect(refetch).toHaveBeenCalledTimes(1);
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

  it("starts a second read only after the first has finished, so a slow stale answer cannot land last", async () => {
    const answers: ((user: User) => void)[] = [];
    let current: User = unregistered;
    const getSession = vi.fn(
      () =>
        new Promise((resolve) =>
          answers.push((user) => {
            current = user;
            resolve({ data: { user }, error: null });
          }),
        ),
    );
    const client = {
      getSession,
      $store: {
        atoms: { session: { get: () => ({ data: { user: current }, refetch: vi.fn() }) } },
      },
    } as never;

    const onOpen = syncSessionFromServer(client);
    const afterSave = syncSessionFromServer(client);
    await vi.waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getSession).toHaveBeenCalledTimes(1);

    answers[0]?.(unregistered);
    await expect(onOpen).resolves.toEqual(unregistered);
    await vi.waitFor(() => expect(getSession).toHaveBeenCalledTimes(2));

    answers[1]?.(registered);
    await expect(afterSave).resolves.toEqual(registered);
  });

  it("still runs the next read when the previous one threw", async () => {
    const { client, getSession } = fakeClient(registered, registered, []);
    getSession.mockRejectedValueOnce(new Error("Network request failed"));

    await expect(syncSessionFromServer(client)).rejects.toThrow("Network request failed");
    await expect(syncSessionFromServer(client)).resolves.toEqual(registered);
  });

  it("aborts a stalled read at the deadline and starts the queued read", async () => {
    vi.useFakeTimers();
    try {
      const { client, getSession } = fakeClient(registered, registered, []);
      getSession.mockImplementationOnce(() => new Promise(() => undefined));

      const opening = syncSessionFromServer(client);
      const afterSave = syncSessionFromServer(client);
      await vi.advanceTimersByTimeAsync(7999);
      expect(getSession).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);

      await expect(opening).resolves.toBeNull();
      expect(getSession).toHaveBeenNthCalledWith(1, {
        query: { disableCookieCache: true },
        fetchOptions: { signal: expect.objectContaining({ aborted: true }) },
      });
      await expect(afterSave).resolves.toEqual(registered);
      expect(getSession).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("also releases the queue if the session store refetch stalls", async () => {
    vi.useFakeTimers();
    try {
      const { client, refetch } = fakeClient(unregistered, registered, [registered]);
      refetch.mockImplementationOnce(() => new Promise(() => undefined));

      const opening = syncSessionFromServer(client);
      const afterSave = syncSessionFromServer(client);
      await vi.advanceTimersByTimeAsync(8000);

      await expect(opening).resolves.toBeNull();
      await expect(afterSave).resolves.toEqual(registered);
      expect(refetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
