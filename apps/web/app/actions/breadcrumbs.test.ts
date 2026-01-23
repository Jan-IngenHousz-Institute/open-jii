import { initClient } from "@ts-rest/core";
import { headers } from "next/headers";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { enrichPathSegments } from "./breadcrumbs";

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

// Mock @ts-rest/core
vi.mock("@ts-rest/core", () => ({
  initClient: vi.fn(),
  initContract: vi.fn(() => ({
    router: vi.fn((routes: unknown) => routes),
  })),
  tsRestFetchApi: vi.fn(),
}));

const mockHeaders = vi.mocked(headers);
const mockInitClient = vi.mocked(initClient);

describe("enrichPathSegments", () => {
  let mockClient: {
    experiments: { getExperimentAccess: ReturnType<typeof vi.fn> };
    macros: { getMacro: ReturnType<typeof vi.fn> };
    protocols: { getProtocol: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      experiments: {
        getExperimentAccess: vi.fn(),
      },
      macros: {
        getMacro: vi.fn(),
      },
      protocols: {
        getProtocol: vi.fn(),
      },
    };

    const mockHeadersList = new Headers();
    mockHeaders.mockResolvedValue(mockHeadersList);
    mockInitClient.mockReturnValue(mockClient as never);
  });

  it("returns empty array for platform root", async () => {
    const result = await enrichPathSegments("/en/platform", "en");

    expect(result).toEqual([]);
  });

  it("returns empty array for first-level routes", async () => {
    const result = await enrichPathSegments("/en/platform/experiments", "en");

    expect(result).toEqual([]);
  });

  it("returns breadcrumbs for nested non-entity paths", async () => {
    const result = await enrichPathSegments("/en/platform/experiments/new", "en");

    expect(result).toEqual([
      {
        segment: "experiments",
        title: "experiments",
        href: "/en/platform/experiments",
      },
      {
        segment: "new",
        title: "new",
        href: "/en/platform/experiments/new",
      },
    ]);
  });

  it("fetches and enriches experiment names for UUID segments", async () => {
    mockClient.experiments.getExperimentAccess.mockResolvedValue({
      status: 200,
      body: {
        experiment: {
          id: "a1b2c3d4-e5f6-4890-abcd-ef1234567890",
          name: "My Experiment",
        },
      },
    });

    const result = await enrichPathSegments(
      "/en/platform/experiments/a1b2c3d4-e5f6-4890-abcd-ef1234567890",
      "en",
    );

    expect(result).toEqual([
      {
        segment: "experiments",
        title: "experiments",
        href: "/en/platform/experiments",
      },
      {
        segment: "a1b2c3d4-e5f6-4890-abcd-ef1234567890",
        title: "My Experiment",
        href: "/en/platform/experiments/a1b2c3d4-e5f6-4890-abcd-ef1234567890",
      },
    ]);

    expect(mockClient.experiments.getExperimentAccess).toHaveBeenCalledWith({
      params: { id: "a1b2c3d4-e5f6-4890-abcd-ef1234567890" },
    });
  });

  it("fetches and enriches macro names for UUID segments", async () => {
    mockClient.macros.getMacro.mockResolvedValue({
      status: 200,
      body: {
        id: "macro-123",
        name: "My Macro",
      },
    });

    const result = await enrichPathSegments("/en/platform/macros/macro-123", "en");

    expect(result).toEqual([
      {
        segment: "macros",
        title: "macros",
        href: "/en/platform/macros",
      },
      {
        segment: "macro-123",
        title: "My Macro",
        href: "/en/platform/macros/macro-123",
      },
    ]);

    expect(mockClient.macros.getMacro).toHaveBeenCalledWith({
      params: { id: "macro-123" },
    });
  });

  it("fetches and enriches protocol names for UUID segments", async () => {
    mockClient.protocols.getProtocol.mockResolvedValue({
      status: 200,
      body: {
        id: "protocol-456",
        name: "My Protocol",
      },
    });

    const result = await enrichPathSegments("/en/platform/protocols/protocol-456", "en");

    expect(result).toEqual([
      {
        segment: "protocols",
        title: "protocols",
        href: "/en/platform/protocols",
      },
      {
        segment: "protocol-456",
        title: "My Protocol",
        href: "/en/platform/protocols/protocol-456",
      },
    ]);

    expect(mockClient.protocols.getProtocol).toHaveBeenCalledWith({
      params: { id: "protocol-456" },
    });
  });

  it("handles API errors gracefully and keeps original segment", async () => {
    mockClient.experiments.getExperimentAccess.mockRejectedValue(new Error("API Error"));

    const result = await enrichPathSegments("/en/platform/experiments/exp-123", "en");

    expect(result).toEqual([
      {
        segment: "experiments",
        title: "experiments",
        href: "/en/platform/experiments",
      },
      {
        segment: "exp-123",
        title: "exp-123",
        href: "/en/platform/experiments/exp-123",
      },
    ]);
  });

  it("handles non-200 status codes gracefully", async () => {
    mockClient.experiments.getExperimentAccess.mockResolvedValue({
      status: 404,
      body: { message: "Not found" },
    });

    const result = await enrichPathSegments("/en/platform/experiments/exp-123", "en");

    expect(result).toEqual([
      {
        segment: "experiments",
        title: "experiments",
        href: "/en/platform/experiments",
      },
      {
        segment: "exp-123",
        title: "exp-123",
        href: "/en/platform/experiments/exp-123",
      },
    ]);
  });

  it("stops at entity ID and excludes tab routes", async () => {
    mockClient.experiments.getExperimentAccess.mockResolvedValue({
      status: 200,
      body: {
        experiment: {
          id: "exp-123",
          name: "My Experiment",
        },
      },
    });

    const result = await enrichPathSegments("/en/platform/experiments/exp-123/data", "en");

    // Should only show breadcrumbs up to the entity ID, not the /data tab
    expect(result).toEqual([
      {
        segment: "experiments",
        title: "experiments",
        href: "/en/platform/experiments",
      },
      {
        segment: "exp-123",
        title: "My Experiment",
        href: "/en/platform/experiments/exp-123",
      },
    ]);
  });

  it("handles experiments-archive route correctly", async () => {
    mockClient.experiments.getExperimentAccess.mockResolvedValue({
      status: 200,
      body: {
        experiment: {
          id: "archived-123",
          name: "Archived Experiment",
        },
      },
    });

    const result = await enrichPathSegments("/en/platform/experiments-archive/archived-123", "en");

    expect(result).toEqual([
      {
        segment: "experiments-archive",
        title: "experiments-archive",
        href: "/en/platform/experiments-archive",
      },
      {
        segment: "archived-123",
        title: "Archived Experiment",
        href: "/en/platform/experiments-archive/archived-123",
      },
    ]);

    expect(mockClient.experiments.getExperimentAccess).toHaveBeenCalledWith({
      params: { id: "archived-123" },
    });
  });

  it("handles different locales correctly", async () => {
    const result = await enrichPathSegments("/de/platform/experiments/new", "de");

    expect(result).toEqual([
      {
        segment: "experiments",
        title: "experiments",
        href: "/de/platform/experiments",
      },
      {
        segment: "new",
        title: "new",
        href: "/de/platform/experiments/new",
      },
    ]);
  });
});
