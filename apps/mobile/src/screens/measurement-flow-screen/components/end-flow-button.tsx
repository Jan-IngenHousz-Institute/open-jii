import React from "react";
import { Alert, Text, TouchableOpacity } from "react-native";

interface EndFlowButtonProps {
  onPress: () => void;
}

export function EndFlowButton({ onPress }: EndFlowButtonProps) {
  const handlePress = () => {
    Alert.alert("End Flow", "Are you sure you want to end the current flow?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "End Flow",
        style: "destructive",
        onPress: onPress,
      },
    ]);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      className="self-end rounded-lg border border-red-500 bg-transparent px-4 py-2"
      activeOpacity={0.7}
    >
      <Text className="text-sm font-medium" style={{ color: "#ef4444" }}>
        Finish Flow
      </Text>
    </TouchableOpacity>
  );
}
