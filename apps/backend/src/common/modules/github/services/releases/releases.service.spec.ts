import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import nock from "nock";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { GithubReleasesService } from "./releases.service";

const REPOSITORY = "Jan-IngenHousz-Institute/ambyte-iot";

function release(overrides: Record<string, unknown> = {}) {
  return {
    tag_name: "v1.3.0",
    name: "Spring release",
    body: "- fixes",
    draft: false,
    prerelease: false,
    published_at: "2026-08-01T10:00:00Z",
    html_url: `https://github.com/${REPOSITORY}/releases/tag/v1.3.0`,
    assets: [
      {
        name: "firmware.bin",
        size: 2048,
        browser_download_url: `https://github.com/${REPOSITORY}/releases/download/v1.3.0/firmware.bin`,
      },
    ],
    ...overrides,
  };
}

describe("GithubReleasesService", () => {
  const testApp = TestHarness.App;
  let service: GithubReleasesService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(GithubReleasesService);
    // The cache outlives a single test in the shared module, so each test
    // starts from a cold read.
    await testApp.module.get<Cache>(CACHE_MANAGER).clear();
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("maps a published release to the contract shape", async () => {
    nock("https://api.github.com")
      .get(`/repos/${REPOSITORY}/releases`)
      .query(true)
      .reply(200, [release()]);

    const result = await service.listReleases(REPOSITORY);

    assertSuccess(result);
    expect(result.value).toEqual([
      {
        version: "v1.3.0",
        name: "Spring release",
        publishedAt: "2026-08-01T10:00:00.000Z",
        prerelease: false,
        latest: true,
        notes: "- fixes",
        releaseUrl: `https://github.com/${REPOSITORY}/releases/tag/v1.3.0`,
        assets: [
          {
            name: "firmware.bin",
            sizeBytes: 2048,
            downloadUrl: `https://github.com/${REPOSITORY}/releases/download/v1.3.0/firmware.bin`,
          },
        ],
      },
    ]);
  });

  it("drops drafts and marks only the newest stable release as latest", async () => {
    nock("https://api.github.com")
      .get(`/repos/${REPOSITORY}/releases`)
      .query(true)
      .reply(200, [
        release({ tag_name: "v1.4.0-rc1", prerelease: true }),
        release({ tag_name: "v1.4.0-draft", draft: true }),
        release({ tag_name: "v1.3.0" }),
        release({ tag_name: "v1.2.0" }),
      ]);

    const result = await service.listReleases(REPOSITORY);

    assertSuccess(result);
    expect(result.value.map((entry) => entry.version)).toEqual(["v1.4.0-rc1", "v1.3.0", "v1.2.0"]);
    // The prerelease is listed but is never the one a rollout would pick.
    expect(result.value.filter((entry) => entry.latest).map((entry) => entry.version)).toEqual([
      "v1.3.0",
    ]);
  });

  it("serves a second read from cache without calling GitHub again", async () => {
    const scope = nock("https://api.github.com")
      .get(`/repos/${REPOSITORY}/releases`)
      .query(true)
      .reply(200, [release()]);

    assertSuccess(await service.listReleases(REPOSITORY));
    const second = await service.listReleases(REPOSITORY);

    assertSuccess(second);
    expect(second.value).toHaveLength(1);
    expect(scope.isDone()).toBe(true);
    expect(nock.pendingMocks()).toHaveLength(0);
  });

  it("fails when GitHub rejects the read", async () => {
    nock("https://api.github.com").get(`/repos/${REPOSITORY}/releases`).query(true).reply(404);

    const result = await service.listReleases(REPOSITORY);

    assertFailure(result);
    expect(result.error.code).toBe("GITHUB_RELEASES_FAILED");
  });
});
