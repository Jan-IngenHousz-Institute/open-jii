"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * WebAuthn is browser-only. The server snapshot is false so server and
 * hydration markup match; passkey controls enable once the browser capability is known.
 */
export function useWebAuthnSupport() {
  return useSyncExternalStore(
    subscribe,
    () => typeof window.PublicKeyCredential !== "undefined",
    () => false,
  );
}
