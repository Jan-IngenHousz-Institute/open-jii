import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import { Theme, darkTheme, lightTheme } from "~/constants/theme";

// Create the theme context
export const ThemeContext = createContext<Theme>(lightTheme);

// Theme provider props
interface ThemeProviderProps {
  children: React.ReactNode;
}

// Theme provider component
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>(lightTheme);
  const [themePreference, setThemePreference] = useState<"system" | "light" | "dark">("light");

  // Load theme preference from storage
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedPreference = await AsyncStorage.getItem("themePreference");
        if (savedPreference) {
          setThemePreference(savedPreference as "system" | "light" | "dark");
        }
      } catch (error) {
        console.error("Failed to load theme preference:", error);
      }
    };

    loadThemePreference();
  }, []);

  // Update theme based on preference
  useEffect(() => {
    const determineTheme = () => {
      if (themePreference === "system") {
        return systemColorScheme === "dark" ? darkTheme : lightTheme;
      }
      return themePreference === "dark" ? darkTheme : lightTheme;
    };

    setTheme(determineTheme());
  }, [themePreference, systemColorScheme]);

  // Function to change theme preference
  const changeTheme = async (newPreference: "system" | "light" | "dark") => {
    try {
      await AsyncStorage.setItem("themePreference", newPreference);
      setThemePreference(newPreference);
    } catch (error) {
      console.error("Failed to save theme preference:", error);
    }
  };

  // Enhanced theme with theme changing function
  const enhancedTheme = {
    ...theme,
    changeTheme,
    themePreference,
  };

  return <ThemeContext.Provider value={enhancedTheme}>{children}</ThemeContext.Provider>;
};
