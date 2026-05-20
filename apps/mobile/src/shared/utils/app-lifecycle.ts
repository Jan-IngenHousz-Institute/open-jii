import { AppState, type AppStateStatus } from "react-native";

// Centralizes AppState "real foreground" detection for non-React services
// (upload queue, time sync, …). Native AppState fires "active" several
// times during boot and around modals (active → inactive → active), and
// every subscriber that listens to raw "change" events ends up duplicating
// the same transition-filter logic. Subscribing here means every consumer
// gets exactly one callback per genuine background → active return.

type Listener = () => void;

const listeners = new Set<Listener>();
let subscription: ReturnType<typeof AppState.addEventListener> | null = null;
let lastState: AppStateStatus = AppState.currentState;

// Cooldown collapses rapid background→active flaps (Android permission /
// location dialogs briefly background the app even when the user perceives
// it as foregrounded — without this, a single user-visible foreground can
// fan out into 3-5 listener invocations).
const COOLDOWN_MS = 2_000;
let lastFireAt = 0;

function handleChange(next: AppStateStatus) {
  const prev = lastState;
  lastState = next;
  if (next !== "active" || prev !== "background") return;
  const now = Date.now();
  if (now - lastFireAt < COOLDOWN_MS) {
    console.log("[app-lifecycle] foregrounded suppressed (cooldown)");
    return;
  }
  lastFireAt = now;
  console.log("[app-lifecycle] foregrounded");
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch (err) {
      console.warn("[app-lifecycle] listener threw:", err);
    }
  }
}

/**
 * Subscribe to real background → active transitions. Returns an
 * unsubscribe function. Boot-time `active → inactive → active` flaps and
 * transient `active → inactive → active` blips (notification shade,
 * permission dialogs) are filtered out.
 */
export function onAppForeground(listener: Listener): () => void {
  listeners.add(listener);
  if (!subscription) {
    subscription = AppState.addEventListener("change", handleChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && subscription) {
      subscription.remove();
      subscription = null;
    }
  };
}
