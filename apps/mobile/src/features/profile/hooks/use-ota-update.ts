import * as Updates from "expo-updates";
import { useEffect } from "react";
import { toast } from "sonner-native";
import { i18n } from "~/shared/i18n";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("ota");

export function useOtaUpdate(): void {
  useEffect(() => {
    if (__DEV__) return;

    let cancelled = false;
    let reloadTimer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;

        toast.info(i18n.t("profile:ota.updateAvailableTitle"), {
          description: i18n.t("profile:ota.updateAvailableBody"),
        });
        const fetched = await Updates.fetchUpdateAsync();
        if (cancelled || !fetched.isNew) return;

        toast.success(i18n.t("profile:ota.updateReadyTitle"), {
          description: i18n.t("profile:ota.updateReadyBody"),
          duration: 2000,
        });
        reloadTimer = setTimeout(() => {
          if (cancelled) return;
          Updates.reloadAsync().catch((err) => {
            if (cancelled) return;
            log.error("reload failed", { err: (err as Error)?.message });
            toast.error(i18n.t("profile:ota.restartFailedTitle"), {
              description: i18n.t("profile:ota.restartFailedBody"),
            });
          });
        }, 2000);
      } catch (err) {
        log.warn("update check failed", { err: (err as Error)?.message });
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(reloadTimer);
    };
  }, []);
}
