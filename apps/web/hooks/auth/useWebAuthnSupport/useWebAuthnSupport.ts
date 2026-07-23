"use client";

import { useEffect, useState } from "react";

/**
 * WebAuthn is browser-only. Start false so server and hydration markup match,
 * then enable passkey controls once the browser capability is known.
 */
export function useWebAuthnSupport() {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(typeof window.PublicKeyCredential !== "undefined");
  }, []);

  return isSupported;
}
