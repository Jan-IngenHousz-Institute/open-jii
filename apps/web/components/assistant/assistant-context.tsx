"use client";

import * as React from "react";

interface AssistantContextValue {
  enabled: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  openAssistant: () => void;
}

const AssistantContext = React.createContext<AssistantContextValue | null>(null);
const disabledAssistant: AssistantContextValue = {
  enabled: false,
  open: false,
  setOpen: () => undefined,
  openAssistant: () => undefined,
};

export function AssistantProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);

  const value = React.useMemo(
    () => ({
      enabled,
      open: enabled && open,
      setOpen,
      openAssistant: () => {
        if (enabled) setOpen(true);
      },
    }),
    [enabled, open],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  return React.useContext(AssistantContext) ?? disabledAssistant;
}
