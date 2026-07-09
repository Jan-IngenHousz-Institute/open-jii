import type { ReactNode } from "react";
import React from "react";
import { PythonMacroProvider } from "~/features/measurement-flow/components/python-macro-provider";
import { useOtaUpdate } from "~/features/profile/hooks/use-ota-update";
import { PostHogProvider } from "~/shared/ui/providers/PostHogProvider";
import { TimeSyncProvider } from "~/shared/ui/time-sync-provider";

import { AppBootstrap } from "./app-bootstrap";
import { OfflineDataSync } from "./offline-data-sync";

// App services that must NOT start while the force-update gate blocks the
// app: analytics, OTA prompts, time sync, the outbox/connection wiring, and
// the Python macro runtime. Rendered inside ForceUpdateGate only.
export function AllowedAppServices({ children }: { children: ReactNode }) {
  useOtaUpdate();

  return (
    <PostHogProvider>
      <TimeSyncProvider>
        <AppBootstrap />
        <OfflineDataSync />
        <PythonMacroProvider>{children}</PythonMacroProvider>
      </TimeSyncProvider>
    </PostHogProvider>
  );
}
