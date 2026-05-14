import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme } from "nativewind";
import React, { createContext, useState, useEffect } from "react";
import { Theme, darkTheme, lightTheme } from "~/shared/constants/theme";

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

// Note: on Android, switching system dark mode while the app is alive will
// not flip the theme until a cold restart. The Activity Configuration stays
// stale because the manifest absorbs `uiMode` in `configChanges` and
// nothing in JS-land can refresh `Appearance.getColorScheme()`. The proper
// fix is a `MainActivity.onConfigurationChanged` override (wiped by
// `expo prebuild --clean`) or a config plugin — neither in scope right now.
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themePreference, setThemePreference] = useState<ThemePreference>("light");

  useEffect(() => {
    AsyncStorage.getItem("themePreference")
      .then((saved) => {
        if (saved === "light" || saved === "dark") setThemePreference(saved);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    colorScheme.set(themePreference);
  }, [themePreference]);

  const changeTheme = async (newPreference: ThemePreference) => {
    try {
      await AsyncStorage.setItem("themePreference", newPreference);
      setThemePreference(newPreference);
    } catch (error) {
      console.error("Failed to save theme preference:", error);
    }
  };

  const theme = themePreference === "dark" ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ ...theme, changeTheme, themePreference }}>
      {children}
    </ThemeContext.Provider>
  );
};
