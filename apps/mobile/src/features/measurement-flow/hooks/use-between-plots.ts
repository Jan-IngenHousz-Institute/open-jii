import { exampleLayout } from "~/features/measurement-flow/screens/measurement-flow-screen/components/flow-nodes/plot-node/next-plot";
import type { ExampleLayout } from "~/features/measurement-flow/screens/measurement-flow-screen/components/flow-nodes/plot-node/next-plot";
import { isScaffoldScreenOn } from "~/features/measurement-flow/screens/measurement-flow-screen/components/flow-nodes/plot-node/scaffold-screen";

/** The layout of a session that sits between plots, so Home keeps offering to continue it. */
export function useBetweenPlots(): ExampleLayout | undefined {
  return isScaffoldScreenOn("d3-continue-card") ? exampleLayout : undefined;
}
