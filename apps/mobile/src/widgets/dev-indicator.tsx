import { Beaker } from "lucide-react-native";
import { View, Text } from "react-native";
import { useIsDevelopment } from "~/hooks/use-is-development";
import { useTheme } from "~/hooks/use-theme";

/**
 * Small header indicator shown only in non-production so users can tell they're in DEV mode.
 * Renders nothing in production.
 */
export function DevIndicator() {
  const isDevelopment = useIsDevelopment();

  const theme = useTheme();
  const { colors } = theme;

  if (!isDevelopment) {
    return null;
  }

  const bgColor = theme.isDark ? colors.dark.surface : colors.light.surface;
  const borderColor = theme.isDark ? colors.dark.border : colors.light.border;
  const textColor = colors.semantic.warning;

  return (
    <View
      className="flex-row items-center gap-1 rounded-md border px-1.5 py-0.5"
      style={{
        backgroundColor: bgColor,
        borderColor,
        borderWidth: 1,
        minHeight: 20,
      }}
    >
      <Beaker size={12} color={textColor} />
      <Text style={{ fontSize: 10, fontWeight: "600", color: textColor }}>DEV Mode</Text>
    </View>
  );
}
