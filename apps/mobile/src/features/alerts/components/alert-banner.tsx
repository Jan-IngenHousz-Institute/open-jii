import { cva } from "class-variance-authority";
import { AlertTriangle, ArrowRight, Info, Sparkles, Wrench, X } from "lucide-react-native";
import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useEnvVar } from "~/shared/stores/environment-store";
import { CtfRichText } from "~/shared/ui/ctf-rich-text";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import type { ComponentAlertFieldsFragment } from "@repo/cms";
import { getSeverity } from "@repo/cms/alert";

const bannerVariants = cva("overflow-hidden border-b border-black/5 dark:border-white/10", {
  variants: {
    severity: {
      info: "bg-[#E2FCFC] dark:bg-teal-800",
      warning: "bg-[#FFF8D6] dark:bg-amber-800",
      critical: "bg-[#FDECEC] dark:bg-red-800",
    },
  },
  defaultVariants: { severity: "info" },
});

const badgeVariants = cva(
  "h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/5 dark:border-white/15",
  {
    variants: {
      severity: {
        info: "bg-[#005e5e]/10 dark:bg-teal-600",
        warning: "bg-[#FFE98A] dark:bg-amber-600",
        critical: "bg-[#F9D2D2] dark:bg-red-600",
      },
    },
    defaultVariants: { severity: "info" },
  },
);

const actionButtonVariants = cva("shrink-0 flex-row items-center gap-1 rounded-lg px-3 py-1.5", {
  variants: {
    severity: {
      info: "bg-[#005e5e] active:bg-[#003a3a] dark:bg-teal-500 dark:active:bg-teal-400",
      warning: "bg-[#D97706] active:bg-[#B45309] dark:bg-amber-500 dark:active:bg-amber-400",
      critical: "bg-[#B91C1C] active:bg-[#991B1B] dark:bg-red-500 dark:active:bg-red-400",
    },
  },
  defaultVariants: { severity: "info" },
});

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

/**
 * Resolves a CMS alert link to an absolute URL openable by `Linking`.
 * Absolute URLs pass through; relative paths (e.g. `/about`) are joined onto
 * the web base URL.
 */
function resolveLinkUrl(url: string, webBaseUrl: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return `${webBaseUrl.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

export function AlertBanner({ alert, onDismiss, topPadding = 0 }: AlertBannerProps) {
  const severity = getSeverity(alert);
  const themeColors = useThemeColors();
  const webBaseUrl = useEnvVar("NEXT_AUTH_URI");

  const Icon = typeIcons[alert.type ?? ""] ?? null;

  return (
    <View className={bannerVariants({ severity })}>
      <View
        className="flex-row items-center gap-3 px-4 py-2.5"
        style={topPadding > 0 ? { paddingTop: topPadding + 10 } : undefined}
      >
        {Icon && (
          <View className={badgeVariants({ severity })}>
            <Icon size={14} color={themeColors.onSurface} />
          </View>
        )}

        <Text className="flex-1 text-sm leading-5 text-gray-900 dark:text-gray-100">
          {alert.title && <Text className="font-semibold">{alert.title}</Text>}
          {alert.title && alert.body?.json && (
            <Text className="text-gray-700 opacity-50 dark:text-gray-100 dark:opacity-70"> · </Text>
          )}
          {alert.body?.json && (
            <CtfRichText
              json={alert.body.json}
              textClass="text-gray-700 dark:text-gray-100"
              inline
            />
          )}
        </Text>

        {alert.link?.url && alert.link?.label && (
          <Pressable
            className={actionButtonVariants({ severity })}
            onPress={() => {
              if (alert.link?.url) {
                void Linking.openURL(resolveLinkUrl(alert.link.url, webBaseUrl));
              }
            }}
          >
            <Text className="text-sm font-medium text-white">{alert.link.label}</Text>
            <ArrowRight size={14} color="white" />
          </Pressable>
        )}

        {alert.dismissible && (
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            accessibilityLabel="Dismiss alert"
            className="shrink-0 p-2"
          >
            <X size={16} color={themeColors.onSurface} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
