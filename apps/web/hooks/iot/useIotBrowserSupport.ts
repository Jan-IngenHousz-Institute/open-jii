"use client";

import { useEffect, useState } from "react";

interface IotBrowserSupport {
  bluetooth: boolean;
  serial: boolean;
  /** True if at least one of bluetooth or serial is supported */
  any: boolean;
}

export function useIotBrowserSupport(): IotBrowserSupport {
  const [support, setSupport] = useState<IotBrowserSupport>({
    bluetooth: false,
    serial: false,
    any: false,
  });

  useEffect(() => {
    const bluetooth = typeof navigator !== "undefined" && "bluetooth" in navigator;
    const serial = typeof navigator !== "undefined" && "serial" in navigator;
    setSupport({ bluetooth, serial, any: bluetooth || serial });
  }, []);

  return support;
}
