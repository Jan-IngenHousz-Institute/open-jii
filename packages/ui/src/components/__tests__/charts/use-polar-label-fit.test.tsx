import { act, renderHook } from "@testing-library/react";
import type { Layout } from "plotly.js";
import { expect, it, vi } from "vitest";

import { usePolarLabelFit } from "../../charts/use-polar-label-fit";

it("retries the regular layout after a change in the chart's measured size", () => {
  const graph = document.createElement("div");
  graph.innerHTML = '<svg class="polarlayer"><g class="plotbg"><path /></g></svg>';
  const circle = graph.querySelector("path");
  if (!circle) throw new Error("Expected a polar plot background");
  const measure = vi
    .spyOn(circle, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(0, 0, 59, 59));
  const { result, rerender } = renderHook(
    ({ layout, height }: { layout: Partial<Layout>; height: number }) =>
      usePolarLabelFit(layout, height),
    { initialProps: { layout: { margin: { t: 62, b: 121 } }, height: 245 } },
  );
  const figure = { data: [], layout: {}, frames: null };

  act(() => result.current.onNormalDraw?.(figure, graph));
  expect(result.current).toMatchObject({ compact: true, maxPlotHeight: 60 });

  measure.mockReturnValue(new DOMRect(0, 0, 137, 137));
  rerender({ layout: { margin: { t: 62, b: 126 } }, height: 325 });
  act(() => result.current.onNormalDraw?.(figure, graph));
  expect(result.current.compact).toBe(false);
});
