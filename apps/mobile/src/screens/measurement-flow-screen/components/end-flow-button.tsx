import React from "react";
import { Alert } from "react-native";
import { Button } from "~/components/Button";

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
    <Button
      title="Finish flow"
      onPress={handlePress}
      variant="light"
      style={{ height: 32, paddingTop: 0, paddingBottom: 0 }}
    />
  );
}
