"use client";

import { createContext, useContext, useState } from "react";

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

  return (
    <DevicesRegisterContext.Provider value={{ openRegister: () => setOpen(true) }}>
      {children}
      <RegisterIotDeviceDialog open={open} onOpenChange={setOpen} />
    </DevicesRegisterContext.Provider>
  );
}
