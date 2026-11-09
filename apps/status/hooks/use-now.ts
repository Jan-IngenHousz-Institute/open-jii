"use client";

import { useEffect, useState } from "react";

const CLOCK_TICK_MS = 15_000;

// The device clock plus how far it is from the server's, so a wrong clock changes no age.
export function useNow(serverOffsetMs: number) {
  const [deviceNow, setDeviceNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setDeviceNow(Date.now()), CLOCK_TICK_MS);

    return () => window.clearInterval(timer);
  }, []);

  return deviceNow + serverOffsetMs;
}
