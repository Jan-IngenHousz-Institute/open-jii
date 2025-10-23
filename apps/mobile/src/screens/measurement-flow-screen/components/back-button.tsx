import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "~/hooks/use-theme";

interface BackButtonProps {
  onPress: () => void;
}

export function BackButton({ onPress }: BackButtonProps) {
  const { colors } = useTheme();

  return (
    <View className="mb-4">
      <TouchableOpacity
        onPress={onPress}
        className="self-start rounded-lg border border-gray-500 bg-transparent px-4 py-2"
        activeOpacity={0.7}
      >
        <Text className="text-sm font-medium" style={{ color: colors.inactive }}>
          ← Back
        </Text>
      </TouchableOpacity>
    </View>
  );
}
