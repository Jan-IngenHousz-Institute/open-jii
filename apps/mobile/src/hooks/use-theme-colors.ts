import { useColorScheme } from "nativewind";
import { colors } from "~/constants/colors";

export type ThemeColorScheme = "light" | "dark";

/**
 * Reactive JS color map for the currently active NativeWind color scheme.
 *
 * Use this ONLY where `className` cannot reach — most notably React
 * Navigation `screenOptions` (`headerStyle`, `tabBarStyle`, `contentStyle`,
 * `headerTintColor`) which take RN style objects rendered outside the
 * NativeWind view tree. Everywhere else, prefer Tailwind utilities with
 * `dark:` variants.
 *
 * Returns the same values that `--background`, `--surface`, etc. resolve to
 * in `global.css`, indexed by scheme rather than by a runtime dark-flag.
 */
export function useThemeColors() {
  const { colorScheme } = useColorScheme();
  const scheme: ThemeColorScheme = colorScheme === "dark" ? "dark" : "light";
  return { scheme, ...colors[scheme] };
}
