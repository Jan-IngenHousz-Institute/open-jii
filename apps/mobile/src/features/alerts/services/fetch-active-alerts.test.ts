import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchActiveAlerts } from "./fetch-active-alerts";

const mockActiveAlerts = vi.fn();

vi.mock("~/shared/stores/environment-store", () => ({
  getEnvVar: (key: string) => {
    if (key === "CONTENTFUL_SPACE_ID") return "space-id";
    if (key === "CONTENTFUL_ACCESS_TOKEN") return "access-token";
    if (key === "CONTENTFUL_SPACE_ENVIRONMENT") return "master";
    return "";
  },
}));

vi.mock("@repo/cms/client", () => ({
  createContentfulClient: () => ({ client: { activeAlerts: mockActiveAlerts } }),
}));

beforeEach(() => {
  mockActiveAlerts.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchActiveAlerts", () => {
  it("returns [] when the Contentful request throws (e.g. invalid token → 401)", async () => {
    mockActiveAlerts.mockRejectedValue(
      new Error("Authentication failed. The access token you provided is invalid"),
    );
    await expect(fetchActiveAlerts("en-US")).resolves.toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("returns the non-null alert items on success", async () => {
    mockActiveAlerts.mockResolvedValue({
      componentAlertCollection: { items: [{ sys: { id: "a" } }, null] },
    });
    await expect(fetchActiveAlerts("en-US")).resolves.toEqual([{ sys: { id: "a" } }]);
  });
});
