import { ActivityIndicator, Text, View } from "react-native";
import { useTheme } from "~/hooks/use-theme";

export function LargeSpinner({ children = "Loading..." }: { children?: string }) {
  const { colors, isDark } = useTheme();
  return (
    <View className="bg-background w-full flex-1 items-center justify-center">
      <ActivityIndicator
        size="large"
        color={isDark ? colors.primary.bright : colors.primary.dark}
      />
      <Text className="text-muted-foreground mt-4 text-lg font-semibold">{children}</Text>
    </View>
  );
}
