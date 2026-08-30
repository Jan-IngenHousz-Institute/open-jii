"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { RegisterIotDeviceDialog } from "./register-iot-device-dialog";

interface DevicesRegisterContextValue {
  openRegister: () => void;
}

const DevicesRegisterContext = createContext<DevicesRegisterContextValue>({
  openRegister: () => undefined,
});

export const useDevicesRegister = () => useContext(DevicesRegisterContext);

/**
 * Provides the single "register device" dialog for the devices section, so the
 * header button and the overview's empty-state CTA open the same dialog.
 */
export function DevicesRegisterProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openRegister = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openRegister }), [openRegister]);

  return (
    <DevicesRegisterContext.Provider value={value}>
      {children}
      <RegisterIotDeviceDialog open={open} onOpenChange={setOpen} />
    </DevicesRegisterContext.Provider>
  );
}
