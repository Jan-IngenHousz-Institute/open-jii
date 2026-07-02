import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveAlerts } from "~/features/alerts/hooks/use-active-alerts";
import { useDismissedAlertsStore } from "~/features/alerts/stores/dismissed-alerts-store";
import { useEnvVar } from "~/shared/stores/environment-store";

import type { ComponentAlertFieldsFragment } from "@repo/cms/lib/__generated/sdk";

import { AlertBanner } from "./alert-banner";

export function AlertsBar() {
  const insets = useSafeAreaInsets();
  const visible = useActiveAlerts();
  const dismiss = useDismissedAlertsStore((s) => s.dismiss);
  const baseUrl = useEnvVar("NEXT_AUTH_URI");

  if (visible.length === 0) return null;

  return (
    <View>
      {visible.map((alert: ComponentAlertFieldsFragment, index: number) => (
        <AlertBanner
          key={alert.sys.id}
          alert={alert}
          onDismiss={() => dismiss(alert.internalName ?? alert.sys.id)}
          topPadding={index === 0 ? insets.top : 0}
          baseUrl={baseUrl}
        />
      ))}
    </View>
  );
}
