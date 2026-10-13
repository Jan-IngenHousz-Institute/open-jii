import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";
import { orpc } from "~/lib/orpc";

import CalibrationsPage from "./page";

vi.mock("@/components/calibrations/list-calibration-definitions", () => ({
  ListCalibrationDefinitions: () => <div data-testid="calibration-definitions" />,
}));

const prefetched = vi.hoisted(() => {
  const state: { queries: unknown[] } = { queries: [] };
  return state;
});

vi.mock("@/components/server-prefetch/prefetched-queries", () => ({
  PrefetchedQueries: ({
    queries,
    children,
  }: {
    queries: (utils: unknown) => unknown[];
    children: React.ReactNode;
  }) => {
    prefetched.queries = queries(orpc);
    return children;
  },
}));

describe("CalibrationsPage", () => {
  it("fetches the calibration definitions while the server renders", () => {
    render(<CalibrationsPage />);

    expect(screen.getByTestId("calibration-definitions")).toBeInTheDocument();
    expect(JSON.stringify(prefetched.queries)).toContain("listCalibrationDefinitions");
  });
});
