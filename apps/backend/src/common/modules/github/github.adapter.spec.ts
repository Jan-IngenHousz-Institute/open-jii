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
