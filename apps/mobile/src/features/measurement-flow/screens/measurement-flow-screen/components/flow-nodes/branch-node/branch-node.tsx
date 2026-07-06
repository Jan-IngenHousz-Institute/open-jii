import React from "react";
import { ActivityIndicator, View } from "react-native";
import { FlowNode } from "~/shared/measurements/flow-node";
import { useTheme } from "~/shared/ui/hooks/use-theme";

interface BranchNodeProps {
  node: FlowNode;
}

// Branch routing happens inside the WorkbookRunner, which never parks on a
// branch cell. This spinner only covers the theoretical transient render.
export function BranchNode(_props: BranchNodeProps) {
  const { colors } = useTheme();

  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}
