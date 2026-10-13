import { afterEach, describe, expect, it, vi } from "vitest";

vi.unmock("~/lib/contentful");

// The module reads its credentials once, when it is first imported.
async function importWithCredentials(spaceId: string, accessToken: string) {
  vi.stubEnv("CONTENTFUL_SPACE_ID", spaceId);
  vi.stubEnv("CONTENTFUL_ACCESS_TOKEN", accessToken);
  vi.resetModules();
  return import("./contentful");
}

describe("buildTimeLocaleParams", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("renders the default locale ahead when the build can read published content", async () => {
    const { buildTimeLocaleParams } = await importWithCredentials("space", "token");

    await expect(buildTimeLocaleParams()).resolves.toEqual([{ locale: "en-US" }]);
  });

  it.each([
    ["no space", "", "token"],
    ["no token", "space", ""],
  ])("renders nothing ahead with %s, as in a pull request build", async (_, spaceId, token) => {
    const { buildTimeLocaleParams } = await importWithCredentials(spaceId, token);

    await expect(buildTimeLocaleParams()).resolves.toEqual([]);
  });
});
