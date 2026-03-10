import { HardHat, User } from "lucide-react-native";
import { View, Text } from "react-native";
import { useIsDevelopment } from "~/hooks/use-is-development";
import { useTheme } from "~/hooks/use-theme";

interface Props {
  size: number;
  color: string;
}

export function DevIndicator({ size, color, focused }: Props & { focused?: boolean }) {
  const isDevelopment = useIsDevelopment();
  const { colors, isDark } = useTheme();

  if (!isDevelopment) {
    return <User size={size} color={color} />;
  }

  // Dev mode styling
  const devColor = focused ? colors.semantic.warning : "#FCD34B";
  const surface = isDark ? colors.dark.surface : colors.light.surface;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <HardHat size={size} color={devColor} strokeWidth={2.5} />

      <View
        style={{
          position: "absolute",
          bottom: -size * 0.1,
          right: -size * 0.1,
          backgroundColor: devColor,
          paddingHorizontal: 3,
          borderRadius: 3,
          borderWidth: 1.5,
          borderColor: surface,
        }}
      >
        <Text
          style={{
            fontSize: size * 0.25,
            fontWeight: "900",
            color: surface,
          }}
        >
          DEV
        </Text>
      </View>
    </View>
  );
}
