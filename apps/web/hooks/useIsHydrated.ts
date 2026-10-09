import { useSyncExternalStore } from "react";

const subscribeNever = () => () => undefined;

/** False on the server and while the page hydrates, true afterwards. */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
