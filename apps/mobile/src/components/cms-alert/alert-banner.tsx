import { AlertTriangle, ArrowRight, Info, Sparkles, Wrench, X } from "lucide-react-native";
import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { CtfRichText } from "~/components/contentful/ctf-rich-text";

import type { ComponentAlertFieldsFragment } from "@repo/cms";

export type Severity = "critical" | "warning" | "info";

export const severityStyles: Record<
  Severity,
  {
    banner: string;
    text: string;
    secondaryText: string;
    badge: string;
    button: string;
    dismiss: string;
    iconColor: string;
  }
> = {
  info: {
    banner: "bg-[#E2FCFC] border-b border-black/5",
    text: "text-[#005e5e]",
    secondaryText: "text-[#005e5e]/85",
    badge: "bg-[#005e5e]/10 border border-black/5",
    button: "bg-[#005e5e] active:bg-[#005151]",
    dismiss: "bg-black/5 active:bg-black/10",
    iconColor: "#005e5e",
  },
  warning: {
    banner: "bg-[#FFF8D6] border-b border-black/5",
    text: "text-[#005e5e]",
    secondaryText: "text-[#005e5e]/85",
    badge: "bg-[#FFE98A] border border-black/5",
    button: "bg-[#005e5e] active:bg-[#005151]",
    dismiss: "bg-black/5 active:bg-black/10",
    iconColor: "#005e5e",
  },
  critical: {
    banner: "bg-[#FDECEC] border-b border-black/5",
    text: "text-[#7F1D1D]",
    secondaryText: "text-[#7F1D1D]/85",
    badge: "bg-[#F9D2D2] border border-black/5",
    button: "bg-[#7F1D1D] active:bg-[#6B1717]",
    dismiss: "bg-black/5 active:bg-black/10",
    iconColor: "#7F1D1D",
  },
};

const typeIcons: Partial<Record<string, React.ComponentType<{ size: number; color: string }>>> = {
  info: Info,
  degraded_service: AlertTriangle,
  maintenance: Wrench,
  new_feature: Sparkles,
};

export interface AlertBannerProps {
  alert: ComponentAlertFieldsFragment;
  onDismiss: () => void;
  topPadding?: number;
}

export function AlertBanner({ alert, onDismiss, topPadding = 0 }: AlertBannerProps) {
  const severity = (alert.severity ?? "info") as Severity;
  const s = severityStyles[severity] ?? severityStyles.info;

  const Icon = typeIcons[alert.type ?? ""] ?? null;

  return (
    <View className={`overflow-hidden ${s.banner}`}>
      <View
        className="flex-row items-center gap-3 px-4 py-2.5"
        style={topPadding > 0 ? { paddingTop: topPadding + 10 } : undefined}
      >
        {Icon && (
          <View className={`h-7 w-7 shrink-0 items-center justify-center rounded-full ${s.badge}`}>
            <Icon size={14} color={s.iconColor} />
          </View>
        )}

        <Text className={`flex-1 text-sm leading-5 ${s.text}`}>
          {alert.title && <Text className="font-semibold">{alert.title}</Text>}
          {alert.title && alert.body?.json && (
            <Text style={{ color: s.iconColor, opacity: 0.5 }}> · </Text>
          )}
          {alert.body?.json && <CtfRichText json={alert.body.json} color={s.iconColor} inline />}
        </Text>

        {alert.link?.url && alert.link?.label && (
          <Pressable
            onPress={() => {
              if (alert.link?.url) {
                void Linking.openURL(alert.link.url);
              }
            }}
            className={`shrink-0 rounded-full px-3 py-1.5 ${s.button}`}
          >
            <View className="flex-row items-center gap-1">
              <Text className="text-sm font-medium text-white">{alert.link.label}</Text>
              <ArrowRight size={14} color="white" />
            </View>
          </Pressable>
        )}

        {alert.dismissible && (
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            accessibilityLabel="Dismiss alert"
            className={`shrink-0 rounded-full p-2 ${s.dismiss}`}
          >
            <X size={16} color={s.iconColor} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
