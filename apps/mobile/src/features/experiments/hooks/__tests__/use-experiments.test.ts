// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useExperiments } from "../use-experiments";

const { useQueryMock, listQueryOptions } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  listQueryOptions: vi.fn((options: object) => options),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: (options: unknown) => useQueryMock(options) };
});

vi.mock("~/shared/api/orpc", () => ({
  orpc: {
    experiments: {
      listExperiments: { queryOptions: listQueryOptions },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  useQueryMock.mockReturnValue({
    data: [
      {
        id: "experiment-1",
        name: "Canopy scan",
        description: null,
        flowMeta: {
          requiresDevice: true,
          questionsOnly: false,
          nodeCount: 3,
          durationMin: 3,
        },
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    isRefetching: false,
  });
});

describe("useExperiments", () => {
  it("carries listExperiments flow metadata into picker options", () => {
    const { result } = renderHook(() => useExperiments());

    expect(result.current.experiments).toEqual([
      expect.objectContaining({
        value: "experiment-1",
        flowMeta: {
          requiresDevice: true,
          questionsOnly: false,
          nodeCount: 3,
          durationMin: 3,
        },
      }),
    ]);
    expect(listQueryOptions).toHaveBeenCalledTimes(1);
    expect(useQueryMock).toHaveBeenCalledTimes(1);
  });
});
