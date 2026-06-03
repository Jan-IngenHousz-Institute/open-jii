import axios from "axios";
import { getEnvVar } from "~/shared/stores/environment-store";

// Probing a generic page (e.g. google.com/generate_204) reports "online"
// whenever the user has any network, even on Wi-Fi-without-internet or
// captive portals where our backend is unreachable. The onlineManager then
// flips React Query's queries on and they hang on the unreachable backend.
// Probing the backend directly ties the "online" signal to actual app usability.
const PING_TIMEOUT_MS = 3000;

export async function isOnline(): Promise<boolean> {
  try {
    const base = getEnvVar("BACKEND_URI");
    await axios.head(base, {
      timeout: PING_TIMEOUT_MS,
      // Any response (incl. 404 on the bare root) proves the backend answers.
      validateStatus: () => true,
    });
    return true;
  } catch {
    return false;
  }
}
