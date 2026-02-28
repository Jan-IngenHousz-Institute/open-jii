import { initClient } from "@ts-rest/core";
import { headers } from "next/headers";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { enrichPathSegments } from "./breadcrumbs";

vi.mock("@ts-rest/core", () => ({
  initClient: vi.fn(),
  initContract: vi.fn(() => ({ router: vi.fn((r: unknown) => r) })),
  tsRestFetchApi: vi.fn(),
}));

const mockClient = {
  experiments: { getExperiment: vi.fn() },
  macros: { getMacro: vi.fn() },
  protocols: { getProtocol: vi.fn() },
};

describe("enrichPathSegments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(headers).mockResolvedValue(new Headers() as never);
    vi.mocked(initClient).mockReturnValue(mockClient as never);
  });

  it("returns empty array for platform root and first-level routes", async () => {
    expect(await enrichPathSegments("/en/platform", "en")).toEqual([]);
    expect(await enrichPathSegments("/en/platform/experiments", "en")).toEqual([]);
  });

  it("returns breadcrumbs for nested non-entity paths", async () => {
    const result = await enrichPathSegments("/en/platform/experiments/new", "en");
    expect(result).toEqual([
      { segment: "experiments", title: "experiments", href: "/en/platform/experiments" },
      { segment: "new", title: "new", href: "/en/platform/experiments/new" },
    ]);
  });

  it.each([
    {
      path: "/en/platform/experiments/exp-1",
      method: "getExperiment" as const,
      entityKey: "experiments" as const,
      id: "exp-1",
      name: "My Experiment",
    },
    {
      path: "/en/platform/macros/macro-1",
      method: "getMacro" as const,
      entityKey: "macros" as const,
      id: "macro-1",
      name: "My Macro",
    },
    {
      path: "/en/platform/protocols/proto-1",
      method: "getProtocol" as const,
      entityKey: "protocols" as const,
      id: "proto-1",
      name: "My Protocol",
    },
  ])(
    "fetches $entityKey name for entity ID segments",
    async ({ path, method, entityKey, id, name }) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      mockClient[entityKey][method].mockResolvedValue({ status: 200, body: { id, name } });

      const result = await enrichPathSegments(path, "en");
      expect(result[1]).toEqual(expect.objectContaining({ segment: id, title: name }));
      expect(mockClient[entityKey][method]).toHaveBeenCalledWith({ params: { id } });
    },
  );

  it("keeps original segment on API error or non-200", async () => {
    mockClient.experiments.getExperiment.mockRejectedValue(new Error("boom"));
    let result = await enrichPathSegments("/en/platform/experiments/e1", "en");
    expect(result[1]?.title).toBe("e1");

    mockClient.experiments.getExperiment.mockResolvedValue({ status: 404 });
    result = await enrichPathSegments("/en/platform/experiments/e1", "en");
    expect(result[1]?.title).toBe("e1");
  });

  it("stops at entity ID and excludes tab routes", async () => {
    mockClient.experiments.getExperiment.mockResolvedValue({
      status: 200,
      body: { id: "exp-1", name: "Study" },
    });
    const result = await enrichPathSegments("/en/platform/experiments/exp-1/data", "en");
    expect(result).toHaveLength(2);
    expect(result[1]?.title).toBe("Study");
  });

  it("handles experiments-archive route", async () => {
    mockClient.experiments.getExperiment.mockResolvedValue({
      status: 200,
      body: { id: "a-1", name: "Archived" },
    });
    const result = await enrichPathSegments("/en/platform/experiments-archive/a-1", "en");
    expect(result[0]?.segment).toBe("experiments-archive");
    expect(result[1]?.title).toBe("Archived");
  });

  it("handles different locales", async () => {
    const result = await enrichPathSegments("/de/platform/experiments/new", "de");
    expect(result[0]?.href).toBe("/de/platform/experiments");
  });
});
