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
    // Drive both the legacy JS theme object AND NativeWind's runtime scheme
    // from the same preference so `dark:` className variants stay in sync
    // with the in-app theme setting.
    colorScheme.set(themePreference);

    const themesByScheme = { light: lightTheme, dark: darkTheme } as const;
    const activeScheme: "light" | "dark" =
      themePreference === "system"
        ? systemColorScheme === "dark"
          ? "dark"
          : "light"
        : themePreference;
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
