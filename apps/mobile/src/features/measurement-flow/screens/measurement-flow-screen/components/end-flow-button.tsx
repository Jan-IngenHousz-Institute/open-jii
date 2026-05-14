import React from "react";
import { showAlert } from "~/shared/ui/AlertDialog";
import { Button } from "~/shared/ui/Button";

interface EndFlowButtonProps {
  onPress: () => void;
}

export function EndFlowButton({ onPress }: EndFlowButtonProps) {
  const handlePress = () => {
    showAlert("Finish Flow", "If you finish now, this measurement flow will not be saved.", [
      {
        text: "Finish Flow",
        variant: "primary",
        onPress: onPress,
      },
      {
        text: "Continue",
        variant: "ghost",
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
