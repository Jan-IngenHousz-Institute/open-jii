import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import { PlotlyChart } from "../../charts/plotly-chart";

const mounts = vi.hoisted(() => ({ count: 0 }));

// Counts how often the chart's Plotly element is created, which a remount would repeat. The
// runtime arrives late, as a download does, so the chart's first draw goes through the lazy import.
vi.mock("../../charts/plotly-runtime", async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return {
    Plot: function MountCountingPlot({ onInitialized }: { onInitialized?: () => void }) {
      useEffect(() => {
        mounts.count += 1;
        onInitialized?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount.
      }, []);
      return null;
    },
    Plotly: { Plots: { resize: vi.fn() } },
    registerTraceTypes: vi.fn().mockResolvedValue(undefined),
  };
});

// React holds back revealing suspended content for 300 ms after a fallback has shown.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
}

describe("PlotlyChart once the runtime has loaded", () => {
  it("keeps a chart first drawn while Plotly was loading, so its zoom survives the next render", async () => {
    const view = render(<PlotlyChart data={[{ type: "scatter", y: [1, 2] }]} layout={{}} />);
    await settle();
    expect(mounts.count).toBe(1);

    await act(async () => {
      view.rerender(<PlotlyChart data={[{ type: "scatter", y: [1, 2, 3] }]} layout={{}} />);
    });
    await settle();

    expect(mounts.count).toBe(1);
  });
});
