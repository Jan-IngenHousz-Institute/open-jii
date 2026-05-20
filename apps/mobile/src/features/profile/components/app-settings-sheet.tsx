import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { Moon, Sun, X } from "lucide-react-native";
import React, { forwardRef, useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "~/shared/i18n";
import type { ThemePreference } from "~/shared/ui/context/ThemeContext";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { useThemePreference } from "~/shared/ui/hooks/use-theme-preference";
import { cn } from "~/shared/utils/cn";

const THEME_OPTIONS: {
  key: ThemePreference;
  labelKey: "themeLight" | "themeDark";
  Icon: typeof Sun;
}[] = [
  { key: "light", labelKey: "themeLight", Icon: Sun },
  { key: "dark", labelKey: "themeDark", Icon: Moon },
];

export const AppSettingsSheet = forwardRef<BottomSheetModal>(
  function AppSettingsSheet(_props, ref) {
    const themeColors = useThemeColors();
    const { t } = useTranslation("profile");
    const { themePreference, changeTheme } = useThemePreference();
    const insets = useSafeAreaInsets();

    const renderBackdrop = useCallback(
      (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      ),
      [],
    );

    const close = () => {
      if (ref && typeof ref !== "function") ref.current?.dismiss();
    };

    return (
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: themeColors.inactive }}
        backgroundStyle={{ backgroundColor: themeColors.card }}
        stackBehavior="push"
      >
        <BottomSheetView
          className="bg-card gap-4 px-4"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 20 }}>
              {t("appSettingsSheet.title")}
            </Text>
            <Pressable onPress={close} hitSlop={8} className="p-1">
              <X size={22} color={themeColors.onSurface} />
            </Pressable>
          </View>

          <View>
            <Text className="text-muted-body mb-2 text-[12px] font-bold uppercase tracking-wider">
              {t("appSettingsSheet.themeLabel")}
            </Text>
            <View className="flex-row gap-2">
              {THEME_OPTIONS.map(({ key, labelKey, Icon }) => {
                const isActive = themePreference === key;
                return (
                  // Force remount on every render so RN's native style cache
                  // (Expo SDK 54) re-applies the theme's resolved colors after
                  // a theme switch — same workaround used by Back/Next.
                  <Pressable
                    key={`${key}-${themeColors.scheme}-${isActive ? "1" : "0"}`}
                    onPress={() => void changeTheme(key)}
                    className={cn(
                      "flex-1 flex-row items-center justify-center gap-2 rounded-lg border px-3 py-2.5",
                      isActive ? "border-primary bg-primary/10" : "border-border bg-transparent",
                    )}
                  >
                    <Icon size={16} color={isActive ? themeColors.brand : themeColors.onSurface} />
                    <Text
                      className={cn(
                        "text-sm font-semibold",
                        isActive ? "text-primary" : "text-on-surface",
                      )}
                    >
                      {t(labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
