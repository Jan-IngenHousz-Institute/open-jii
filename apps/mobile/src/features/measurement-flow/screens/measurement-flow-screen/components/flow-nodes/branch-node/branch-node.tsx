import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { FlowNode } from "~/shared/measurements/flow-node";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { ErrorState } from "../measurement-node/components/error-state";
import { evaluateAndRoute } from "../utils/evaluate-and-route";

interface BranchNodeProps {
  node: FlowNode;
}

// No UI of its own: on becoming active it auto-evaluates the branch conditions
// and routes to the matching path. The spinner shows only until the jump.
export function BranchNode({ node }: BranchNodeProps) {
  const { colors } = useTheme();
  const [routingError, setRoutingError] = useState<Error>();

  useEffect(() => {
    // Re-run only when a different branch becomes active; everything else is
    // read from the stores inside evaluateAndRoute.
    setRoutingError(evaluateAndRoute(node));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  if (routingError) return <ErrorState error={routingError} />;

  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}
