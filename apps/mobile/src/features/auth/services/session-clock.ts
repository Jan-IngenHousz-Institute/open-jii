import { AppState } from "react-native";

import { advanceSessionClock, subscribeSessionCache } from "./session-cache";

const CLOCK_INTERVAL = 30_000;
let readers = 0;
let stop: (() => void) | undefined;

function start() {
  const tick = () => advanceSessionClock();
  const timer = setInterval(tick, CLOCK_INTERVAL);
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") tick();
  });
  tick();
  return () => {
    clearInterval(timer);
    sub.remove();
  };
}

// One timer for every reader, so a guest session ends while the app stays open.
export function subscribeSession(listener: () => void) {
  const unsubscribe = subscribeSessionCache(listener);
  if (readers++ === 0) stop = start();
  return () => {
    unsubscribe();
    if (--readers === 0) stop?.();
  };
}
