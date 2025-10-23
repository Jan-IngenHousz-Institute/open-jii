import React from "react";
import { View } from "react-native";
import { Button } from "~/components/Button";

interface BackButtonProps {
  onPress: () => void;
}

export function BackButton({ onPress }: BackButtonProps) {
  return (
    <View className="mb-4">
      <Button
        title="← Back"
        onPress={onPress}
        style={{
          width: "auto",
          alignSelf: "flex-start",
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: "#6B7280",
        }}
        textStyle={{ color: "#6B7280", fontSize: 14 }}
      />
    </View>
  );
}
