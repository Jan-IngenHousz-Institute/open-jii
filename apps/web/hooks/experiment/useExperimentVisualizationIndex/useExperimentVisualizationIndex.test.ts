import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentVisualizationIndex } from "./useExperimentVisualizationIndex";

describe("useExperimentVisualizationIndex", () => {
  it("reads the experiment's visualizations as one full page", async () => {
    const visualizations = [
      createVisualization({ experimentId: "exp-1" }),
      createVisualization({ experimentId: "exp-1" }),
    ];
    const spy = server.mount(contract.experiments.listExperimentVisualizations, {
      body: visualizations,
    });

    const { result } = renderHook(() => useExperimentVisualizationIndex("exp-1"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(spy.params.id).toBe("exp-1");
    expect(spy.calls[0]?.query).toMatchObject({ limit: "100", offset: "0" });
  });
});
