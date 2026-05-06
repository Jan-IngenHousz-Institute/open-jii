import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertBanner } from "~/components/cms-alert/alert-banner";
import { useActiveAlerts } from "~/hooks/use-active-alerts";

import type { ComponentAlertFieldsFragment } from "@repo/cms/lib/__generated/sdk";

const DISMISSED_KEY = "alert-dismissed-ids";
const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

type Severity = keyof typeof SEVERITY_ORDER;

export function AlertsBar() {
  const insets = useSafeAreaInsets();
  const { data: alerts } = useActiveAlerts();
  const [dismissed, setDismissed] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(DISMISSED_KEY)
      .then((raw) => {
        if (cancelled) return;
        try {
          const parsed = raw ? (JSON.parse(raw) as string[]) : [];
          setDismissed(new Set(parsed));
        } catch {
          setDismissed(new Set());
        }
      })
      .catch(() => {
        if (!cancelled) setDismissed(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = useCallback((key: string) => {
    setDismissed((prev) => {
      const next = new Set(prev ?? []);
      next.add(key);
      void AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  if (!alerts || alerts.length === 0 || dismissed === null) return null;

  const visible = alerts
    .filter((a) => !dismissed.has(a.internalName ?? a.sys.id))
    .sort((a, b) => {
      const aOrder = SEVERITY_ORDER[(a.severity ?? "info") as Severity] ?? 2;
      const bOrder = SEVERITY_ORDER[(b.severity ?? "info") as Severity] ?? 2;
      return aOrder - bOrder;
    });

  if (visible.length === 0) return null;

  return (
    <View>
      {visible.map((alert: ComponentAlertFieldsFragment, index: number) => (
        <AlertBanner
          key={alert.sys.id}
          alert={alert}
          onDismiss={() => handleDismiss(alert.internalName ?? alert.sys.id)}
          topPadding={index === 0 ? insets.top : 0}
        />
      ))}
    </View>
  );
}
