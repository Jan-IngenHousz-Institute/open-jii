import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { FlowNode } from "~/shared/measurements/flow-node";
import { evaluateAndRoute } from "../utils/evaluate-and-route";

interface BranchNodeProps {
  node: FlowNode;
}

// No UI of its own: on becoming active it auto-evaluates the branch conditions
// and routes to the matching path. The spinner shows only until the jump.
export function BranchNode({ node }: BranchNodeProps) {
  const { colors } = useTheme();

  useEffect(() => {
    // Re-run only when a different branch becomes active; everything else is
    // read from the stores inside evaluateAndRoute.
    evaluateAndRoute(node);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}
