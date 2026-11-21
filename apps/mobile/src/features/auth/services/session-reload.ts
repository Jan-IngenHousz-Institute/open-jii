import type { createOpenJiiAuthClient } from "@repo/auth/client.native";

type AuthClient = Pick<ReturnType<typeof createOpenJiiAuthClient>, "getSession" | "$store">;

// The store's fetch can be superseded by the one the Expo plugin starts when the cookie changes.
const MAX_STORE_SYNC_ATTEMPTS = 3;

// Each answer rewrites the cookie cache as it arrives, so a slow earlier read must not land last.
const pendingSyncs = new WeakMap<AuthClient, Promise<unknown>>();

/**
 * Reads the session from the database, past the server's one-day cookie cache, then waits until
 * the session store `useSession` renders from agrees. Reads for one client run one at a time, and
 * each starts fresh once the previous one has finished. Resolves with the user the store holds, or
 * null when the server could not be read.
 */
export function syncSessionFromServer(client: AuthClient) {
  const previous = pendingSyncs.get(client) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => readAndApply(client));
  pendingSyncs.set(client, next);
  return next;
}

async function readAndApply(client: AuthClient) {
  // A plain call, so no later store fetch can cancel it before it answers.
  const fresh = await client.getSession({ query: { disableCookieCache: true } });
  if (fresh.error || !fresh.data) return null;
  const registered = fresh.data.user.registered;

  const sessionAtom = client.$store.atoms.session;
  for (let attempt = 0; attempt < MAX_STORE_SYNC_ATTEMPTS; attempt++) {
    const user = sessionAtom.get().data?.user;
    if (user && user.registered === registered) return user;
    // The fresh response rewrote the cookie cache, so an ordinary fetch now reads the new value.
    await sessionAtom.get().refetch();
  }
  return sessionAtom.get().data?.user ?? null;
}
