import { refreshSession } from "~/features/auth/api/refresh.api";
import { getAuthClient } from "~/features/auth/services/auth";
import { getCachedSession } from "~/features/auth/services/session-cache";
import { configureAuthRefresh } from "~/shared/api/orpc-fetch";

// Wires the auth feature into the shared fetcher's 401 seam. Imported for
// its side effect from app-bootstrap; module-level so the handler exists
// before the first request fires.
configureAuthRefresh({
  getCookie: () => getAuthClient().getCookie(),
  hasCachedSession: () => !!getCachedSession(),
  refreshSession,
  signOut: async () => {
    await getAuthClient().signOut();
  },
});
