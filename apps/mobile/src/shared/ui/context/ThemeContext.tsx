import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme } from "nativewind";
import React, { createContext, useState, useEffect } from "react";
import { Appearance } from "react-native";
import { Theme, darkTheme, lightTheme } from "~/shared/constants/theme";
import { createLogger } from "~/shared/utils/logger";

const log = createLogger("theme");

export type ThemePreference = "light" | "dark";

export interface ThemeContextValue extends Theme {
  themePreference: ThemePreference;
  changeTheme: (preference: ThemePreference) => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextValue>({
  ...lightTheme,
  themePreference: "light",
  changeTheme: () => Promise.resolve(),
});

interface ThemeProviderProps {
  children: React.ReactNode;
}

// Seed the initial preference from the OS once on first launch, then never
// listen for OS changes again — the user toggles light/dark manually from
// the app settings sheet after that.
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    Appearance.getColorScheme() === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const saved = await AsyncStorage.getItem("themePreference");
        if (saved === "dark" || saved === "light") {
          setThemePreference(saved);
          return;
        }
        // Persist the OS-derived seed so subsequent launches pick the same
        // even if the user never opens the settings sheet.
        const seed: ThemePreference = Appearance.getColorScheme() === "dark" ? "dark" : "light";
        setThemePreference(seed);
        await AsyncStorage.setItem("themePreference", seed);
      } catch (error) {
        log.error("Failed to load theme preference", { err: (error as Error)?.message });
      }
    };
    loadThemePreference();
  }, []);

  useEffect(() => {
    colorScheme.set(themePreference);
  }, [themePreference]);

  const changeTheme = async (newPreference: ThemePreference) => {
    try {
      await AsyncStorage.setItem("themePreference", newPreference);
      setThemePreference(newPreference);
    } catch (error) {
      log.error("Failed to save theme preference", { err: (error as Error)?.message });
    }
  };

  const theme = themePreference === "dark" ? darkTheme : lightTheme;
  const value: ThemeContextValue = {
    ...theme,
    changeTheme,
    themePreference,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
