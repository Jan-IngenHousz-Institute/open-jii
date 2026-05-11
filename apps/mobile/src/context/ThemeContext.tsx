import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme } from "nativewind";
import React, { createContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import { Theme, darkTheme, lightTheme } from "~/constants/theme";

type ThemePreference = "system" | "light" | "dark";

export const ThemeContext = createContext<Theme>(lightTheme);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
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
      themePreference === "system"
        ? systemColorScheme === "dark"
          ? "dark"
          : "light"
        : themePreference;
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

  const enhancedTheme = {
    ...theme,
    changeTheme,
    themePreference,
  };

  return <ThemeContext.Provider value={enhancedTheme}>{children}</ThemeContext.Provider>;
};
