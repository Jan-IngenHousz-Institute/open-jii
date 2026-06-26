import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { cva } from "class-variance-authority";
import { Check, Moon, Sun, X } from "lucide-react-native";
import React, { forwardRef, useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SupportedLocale } from "~/shared/i18n";
import { setLanguage, useTranslation } from "~/shared/i18n";
import type { ThemePreference } from "~/shared/ui/context/ThemeContext";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { useThemePreference } from "~/shared/ui/hooks/use-theme-preference";

const THEME_OPTIONS: {
  key: ThemePreference;
  labelKey: "themeLight" | "themeDark";
  Icon: typeof Sun;
}[] = [
  { key: "light", labelKey: "themeLight", Icon: Sun },
  { key: "dark", labelKey: "themeDark", Icon: Moon },
];

// Language names are shown as autonyms (each in its own language), so they are
// intentionally not translated.
const LANGUAGE_OPTIONS: { key: SupportedLocale; name: string }[] = [
  { key: "en-US", name: "English" },
  { key: "nl-NL", name: "Nederlands" },
];

// Shared selected/unselected styling for the theme and language option rows.
// The theme row lays out as equal-width pills; the language row is a full-width
// list item, so the layout is a variant rather than tacked on per call site.
const optionRowVariants = cva("flex-row items-center rounded-lg border px-3 py-2.5", {
  variants: {
    active: {
      true: "border-primary bg-primary/10",
      false: "border-border bg-transparent",
    },
    layout: {
      pill: "flex-1 justify-center gap-2",
      row: "justify-between",
    },
  },
});

const optionLabelVariants = cva("text-sm font-semibold", {
  variants: {
    active: {
      true: "text-primary",
      false: "text-on-surface",
    },
  },
});

export const AppSettingsSheet = forwardRef<BottomSheetModal>(
  function AppSettingsSheet(_props, ref) {
    const themeColors = useThemeColors();
    const { t, i18n } = useTranslation("profile");
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
                  // a theme switch (same workaround used by Back/Next).
                  <Pressable
                    key={`${key}-${themeColors.scheme}-${isActive ? "1" : "0"}`}
                    onPress={() => void changeTheme(key)}
                    className={optionRowVariants({ active: isActive, layout: "pill" })}
                  >
                    <Icon size={16} color={isActive ? themeColors.brand : themeColors.onSurface} />
                    <Text className={optionLabelVariants({ active: isActive })}>{t(labelKey)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text className="text-muted-body mb-2 text-[12px] font-bold uppercase tracking-wider">
              {t("appSettingsSheet.languageLabel")}
            </Text>
            <View className="gap-2">
              {LANGUAGE_OPTIONS.map(({ key, name }) => {
                const isActive = i18n.language === key;
                return (
                  <Pressable
                    key={`${key}-${themeColors.scheme}-${isActive ? "1" : "0"}`}
                    onPress={() => void setLanguage(key)}
                    className={optionRowVariants({ active: isActive, layout: "row" })}
                  >
                    <View className="flex-1">
                      <Text className={optionLabelVariants({ active: isActive })}>{name}</Text>
                      {key === "nl-NL" ? (
                        <Text className="text-muted-body mt-0.5 text-[12px]">
                          {t("appSettingsSheet.dutchTranslationNote")}
                        </Text>
                      ) : null}
                    </View>
                    {isActive ? <Check size={18} color={themeColors.brand} /> : null}
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
