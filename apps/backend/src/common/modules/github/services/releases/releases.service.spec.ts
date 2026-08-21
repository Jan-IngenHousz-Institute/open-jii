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

  it("reports an unreadable repository as not found rather than a platform fault", async () => {
    nock("https://api.github.com").get(`/repos/${REPOSITORY}/releases`).query(true).reply(404);

    const result = await service.listReleases(REPOSITORY);

    assertFailure(result);
    expect(result.error.code).toBe("GITHUB_RELEASES_FAILED");
    // A typo'd or private repository must not read as a 500.
    expect(result.error.statusCode).toBe(404);
  });

  it("does not re-ask GitHub about a repository that just failed", async () => {
    let calls = 0;
    nock("https://api.github.com")
      .get(`/repos/${REPOSITORY}/releases`)
      .query(true)
      .times(2)
      .reply(() => {
        calls += 1;
        return [500, {}];
      });

    assertFailure(await service.listReleases(REPOSITORY));
    assertFailure(await service.listReleases(REPOSITORY));

    // One bad repository must not burn the shared hourly budget.
    expect(calls).toBe(1);
  });

  it("serves the last good answer when a refresh fails", async () => {
    nock("https://api.github.com")
      .get(`/repos/${REPOSITORY}/releases`)
      .query(true)
      .reply(200, [release()]);
    assertSuccess(await service.listReleases(REPOSITORY));

    vi.useFakeTimers();
    // Past FRESH_MS so the read goes back to GitHub, but inside CACHE_TTL_MS so
    // the previous answer is still there to fall back on.
    vi.setSystemTime(Date.now() + 30 * 60 * 1000);
    nock("https://api.github.com").get(`/repos/${REPOSITORY}/releases`).query(true).reply(500);

    const stale = await service.listReleases(REPOSITORY);

    vi.useRealTimers();
    assertSuccess(stale);
    expect(stale.value.map((entry) => entry.version)).toEqual(["v1.3.0"]);
  });
});
