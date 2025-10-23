import { useContext } from "react";
import { Theme, defaultTheme } from "~/constants/theme";
import { ThemeContext } from "~/context/ThemeContext";

// Hook to access the current theme with NativeWind classes
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  return theme || defaultTheme;
}
