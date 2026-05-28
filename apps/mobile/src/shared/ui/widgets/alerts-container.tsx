import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDismissedAlertsStore } from "~/features/measurement-flow/stores/dismissed-alerts-store";
import { useActiveAlerts } from "~/shared/ui/hooks/use-active-alerts";
import { AlertBanner } from "~/shared/ui/widgets/alert-banner";

import type { ComponentAlertFieldsFragment } from "@repo/cms/lib/__generated/sdk";

export function AlertsBar() {
  const insets = useSafeAreaInsets();
  const visible = useActiveAlerts();
  const dismiss = useDismissedAlertsStore((s) => s.dismiss);

  if (visible.length === 0) return null;

  return (
    <View>
      {visible.map((alert: ComponentAlertFieldsFragment, index: number) => (
        <AlertBanner
          key={alert.sys.id}
          alert={alert}
          onDismiss={() => dismiss(alert.internalName ?? alert.sys.id)}
          topPadding={index === 0 ? insets.top : 0}
        />
      ))}
    </View>
  );
}
