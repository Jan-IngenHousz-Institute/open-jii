"use client";

import { useEffect } from "react";

import type { IotBrowserSupport } from "./useIotBrowserSupport";
import type { ConnectionType } from "./useIotCommunication/useIotCommunication";

// When exactly one transport is available in this browser, select it so the
// user is not asked to pick between one real option and one dead one.
export function useAutoConnectionType(
  browserSupport: Pick<IotBrowserSupport, "bluetooth" | "serial">,
  setConnectionType: (type: ConnectionType) => void,
) {
  useEffect(() => {
    if (!browserSupport.bluetooth && browserSupport.serial) {
      setConnectionType("serial");
    } else if (browserSupport.bluetooth && !browserSupport.serial) {
      setConnectionType("bluetooth");
    }
  }, [browserSupport.bluetooth, browserSupport.serial, setConnectionType]);
}
