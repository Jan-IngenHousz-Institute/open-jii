import * as Updates from "expo-updates";
import { useEffect } from "react";
import { toast } from "sonner-native";

export function useOtaUpdate(): void {
  useEffect(() => {
    if (__DEV__) return;

    let cancelled = false;

    void (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;

        toast.info("Update available", { description: "Downloading…" });
        const fetched = await Updates.fetchUpdateAsync();
        if (cancelled || !fetched.isNew) return;

        toast.success("Update ready", {
          description: "Restarting to apply.",
          duration: 2000,
        });
        setTimeout(() => {
          void Updates.reloadAsync();
        }, 2000);
      } catch (err) {
        console.warn("[ota] update check failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
