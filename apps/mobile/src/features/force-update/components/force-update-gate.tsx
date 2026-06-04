import * as Application from "expo-application";
import { ArrowRight, ArrowUpCircle } from "lucide-react-native";
import React from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForceUpdateGate } from "~/features/force-update/hooks/use-force-update-gate";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { CtfRichText } from "~/shared/ui/ctf-rich-text";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import type { PageForceUpdateFieldsFragment } from "@repo/cms/lib/__generated/sdk";

/**
 * Replaces the app tree with a full-screen gate when the running version is
 * gated (no navigation or background calls while gated). Must be mounted inside
 * the query/safe-area/theme providers.
 */
export function ForceUpdateGate({
  children,
  onStatusChange,
}: {
  children: React.ReactNode;
  onStatusChange?: (status: ReturnType<typeof useForceUpdateGate>["status"]) => void;
}) {
  const { status, gate } = useForceUpdateGate();

  React.useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  if (status === "checking") return null;
  if (status === "gated" && gate) return <ForceUpdateScreen gate={gate} />;

  return <>{children}</>;
}

function ForceUpdateScreen({ gate }: { gate: PageForceUpdateFieldsFragment }) {
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const { t } = useTranslation("forceUpdate");

  const url = gate.updateCta?.url ?? undefined;
  const running = Application.nativeApplicationVersion ?? undefined;

  return (
    <View
      className="bg-background flex-1 gap-5 px-6"
      style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: concentric brand rings around the update icon */}
        <View className="mb-7 items-center">
          <View className="bg-primary/5 h-28 w-28 items-center justify-center rounded-full">
            <View className="bg-primary/10 h-20 w-20 items-center justify-center rounded-full">
              <View className="bg-primary/20 h-14 w-14 items-center justify-center rounded-full">
                <ArrowUpCircle size={32} color={themeColors.brand} />
              </View>
            </View>
          </View>
        </View>

        <Text className="text-foreground mb-2 text-center text-3xl font-bold">
          {gate.title ?? t("title")}
        </Text>

        {/* Current → required version pills */}
        {gate.minVersion ? (
          <View className="mb-6 flex-row items-center justify-center gap-2">
            {running ? (
              <View className="bg-surface rounded-full px-3 py-1">
                <Text className="text-muted-foreground text-xs font-medium">v{running}</Text>
              </View>
            ) : null}
            {running ? <ArrowRight size={14} color={themeColors.onSurface} /> : null}
            <View className="bg-primary/10 rounded-full px-3 py-1">
              <Text className="text-primary text-xs font-semibold">v{gate.minVersion}+</Text>
            </View>
          </View>
        ) : null}

        <View className="w-full">
          {gate.body?.json ? (
            <CtfRichText json={gate.body.json} textClass="text-foreground" />
          ) : (
            <Text className="text-muted-foreground text-center text-base leading-6">
              {t("description")}
            </Text>
          )}
        </View>
      </ScrollView>

      <Button
        title={gate.updateCta?.label ?? t("cta")}
        variant="primary"
        size="lg"
        isDisabled={!url}
        onPress={() => {
          if (url) void Linking.openURL(url);
        }}
      />
    </View>
  );
}
