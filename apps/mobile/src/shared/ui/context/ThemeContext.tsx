import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme } from "nativewind";
import React, { createContext, useState, useEffect } from "react";
import { Appearance, AppState, useColorScheme } from "react-native";
import { Theme, darkTheme, lightTheme } from "~/shared/constants/theme";

export type ThemePreference = "system" | "light" | "dark";

export interface ThemeContextValue extends Theme {
  themePreference: ThemePreference;
  changeTheme: (preference: ThemePreference) => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextValue>({
  ...lightTheme,
  themePreference: "system",
  changeTheme: () => Promise.resolve(),
});

interface ThemeProviderProps {
  children: React.ReactNode;
}

// Note: on Android, switching system dark mode while the app is alive will
// not flip the theme until a cold restart. The Activity Configuration stays
// stale because the manifest absorbs `uiMode` in `configChanges` and
// nothing in JS-land can refresh `Appearance.getColorScheme()`. The proper
// fix is a `MainActivity.onConfigurationChanged` override (wiped by
// `expo prebuild --clean`) or a config plugin — neither in scope right now.
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // useColorScheme can return null on Android cold-start before Appearance
  // resolves. We keep the hook subscription for live OS-theme changes, but
  // also seed an Appearance.getColorScheme() snapshot so the first render
  // reflects the OS preference instead of defaulting to light.
  const hookColorScheme = useColorScheme();
  const [systemColorScheme, setSystemColorScheme] = useState<"light" | "dark">(() =>
    Appearance.getColorScheme() === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    if (hookColorScheme === "dark" || hookColorScheme === "light") {
      setSystemColorScheme(hookColorScheme);
    }
  }, [hookColorScheme]);

  // Belt-and-braces: Appearance.addChangeListener fires on Android even when
  // useColorScheme's null-cycle would otherwise hide the change.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme: next }) => {
      if (next === "dark" || next === "light") setSystemColorScheme(next);
    });
    return () => sub.remove();
  }, []);

  // On Android the activity absorbs `uiMode` via configChanges, which means
  // Appearance.addChangeListener never fires when the OS theme is flipped
  // while the app is backgrounded. Re-poll Appearance.getColorScheme() each
  // time the app returns to the foreground so users that toggle dark mode
  // outside the app see the new theme on resume.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      const current = Appearance.getColorScheme();
      if (current === "dark" || current === "light") setSystemColorScheme(current);
    });
    return () => sub.remove();
  }, []);

  const [theme, setTheme] = useState<Theme>(lightTheme);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");

  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedPreference = await AsyncStorage.getItem("themePreference");
        if (savedPreference) {
          setThemePreference(savedPreference as ThemePreference);
        }
      } catch (error) {
        console.error("Failed to load theme preference:", error);
      }
    };

    loadThemePreference();
  }, []);

  useEffect(() => {
    // Resolve "system" to an explicit "light" | "dark" before driving
    // NativeWind. Passing "system" to `colorScheme.set` clears its
    // observable and falls back to NativeWind's internal `systemColorScheme`
    // — which doesn't reliably refresh CSS-var subscriptions on Android
    // when the OS preference is set before the first set() call. Driving an
    // explicit value keeps NativeWind's class-mode + var swap in sync with
    // the legacy JS theme object.
    const themesByScheme = { light: lightTheme, dark: darkTheme } as const;
    const activeScheme: "light" | "dark" =
      themePreference === "system" ? systemColorScheme : themePreference;
    colorScheme.set(activeScheme);
    setTheme(themesByScheme[activeScheme]);
  }, [themePreference, systemColorScheme]);

  const changeTheme = async (newPreference: ThemePreference) => {
    try {
      await AsyncStorage.setItem("themePreference", newPreference);
      setThemePreference(newPreference);
    } catch (error) {
      console.error("Failed to save theme preference:", error);
    }
  };

  const value: ThemeContextValue = {
    ...theme,
    changeTheme,
    themePreference,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
