import { TestHarness } from "../../../test/test-harness";
import { assertFailure, assertSuccess, success } from "../../utils/fp-utils";
import { GithubAdapter } from "./github.adapter";
import { GithubConfigService } from "./services/config/config.service";
import { GithubReleasesService } from "./services/releases/releases.service";

describe("GithubAdapter", () => {
  const testApp = TestHarness.App;
  let adapter: GithubAdapter;
  let releasesService: GithubReleasesService;
  let configService: GithubConfigService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    adapter = testApp.module.get(GithubAdapter);
    releasesService = testApp.module.get(GithubReleasesService);
    configService = testApp.module.get(GithubConfigService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("reads the family's repository and delegates to the releases service", async () => {
    const listReleases = vi.spyOn(releasesService, "listReleases").mockResolvedValue(success([]));

    const result = await adapter.listFirmwareReleases("ambyte");

    assertSuccess(result);
    expect(listReleases).toHaveBeenCalledWith(process.env.FIRMWARE_REPO_AMBYTE);
  });

  it("lists only the CO2Dot firmware line, with the fw/ prefix dropped from the version", async () => {
    const release = (version: string, prerelease = false) => ({
      version,
      name: version,
      publishedAt: "2026-11-26T10:00:00.000Z",
      prerelease,
      latest: false,
      notesHtml: null,
      releaseUrl: `https://github.com/Jan-IngenHousz-Institute/CO2Dot/releases/tag/${version}`,
      assets: [],
    });
    vi.spyOn(configService, "repositoryFor").mockReturnValue("Jan-IngenHousz-Institute/CO2Dot");
    vi.spyOn(releasesService, "listReleases").mockResolvedValue(
      success([
        { ...release("gui/v2.0.0"), latest: true },
        release("fw/v0.2.0", true),
        release("hw/v1.1.0"),
        release("fw/v0.1.0"),
      ]),
    );

    const result = await adapter.listFirmwareReleases("co2dot");

    assertSuccess(result);
    expect(result.value.map(({ version, latest }) => ({ version, latest }))).toEqual([
      { version: "v0.2.0", latest: false },
      { version: "v0.1.0", latest: true },
    ]);
    expect(result.value[1].releaseUrl).toContain("/tag/fw/v0.1.0");
  });

  it("passes other families' releases through unchanged", async () => {
    const releases = [
      {
        version: "v1.07",
        name: null,
        publishedAt: "2026-11-26T10:00:00.000Z",
        prerelease: false,
        latest: true,
        notesHtml: null,
        releaseUrl: "https://github.com/Jan-IngenHousz-Institute/miniPar/releases/tag/v1.07",
        assets: [],
      },
    ];
    vi.spyOn(configService, "repositoryFor").mockReturnValue("Jan-IngenHousz-Institute/miniPar");
    vi.spyOn(releasesService, "listReleases").mockResolvedValue(success(releases));

    const result = await adapter.listFirmwareReleases("minipar");

    assertSuccess(result);
    expect(result.value).toEqual(releases);
  });

  it("reports an unconfigured family as not found without calling GitHub", async () => {
    const listReleases = vi.spyOn(releasesService, "listReleases");
    vi.spyOn(configService, "repositoryFor").mockReturnValue(undefined);

    const result = await adapter.listFirmwareReleases("minipar");

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
    // A missing repository is a configuration gap, not a failed request.
    expect(listReleases).not.toHaveBeenCalled();
  });
});
