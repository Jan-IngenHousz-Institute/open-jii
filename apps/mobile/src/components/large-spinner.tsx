import { ActivityIndicator, Text, View } from "react-native";
import { useThemeColors } from "~/hooks/use-theme-colors";

export function LargeSpinner({ children = "Loading..." }: { children?: string }) {
  const { brand } = useThemeColors();
  return (
    <View className="bg-background w-full flex-1 items-center justify-center">
      <ActivityIndicator size="large" color={brand} />
      <Text className="text-muted-foreground mt-4 text-lg font-semibold">{children}</Text>
    </View>
  );
}
