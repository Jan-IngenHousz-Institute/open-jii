import { useContext } from "react";
import { ThemeContext } from "~/shared/ui/context/ThemeContext";
import type { ThemePreference } from "~/shared/ui/context/ThemeContext";

export function useThemePreference(): {
  themePreference: ThemePreference;
  changeTheme: (preference: ThemePreference) => Promise<void>;
} {
  const { themePreference, changeTheme } = useContext(ThemeContext);
  return { themePreference, changeTheme };
}
