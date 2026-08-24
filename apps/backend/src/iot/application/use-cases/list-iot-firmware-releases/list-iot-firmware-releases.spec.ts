import {
  assertFailure,
  assertSuccess,
  failure,
  success,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GITHUB_PORT } from "../../../core/ports/github.port";
import type { GithubPort } from "../../../core/ports/github.port";
import { ListIotFirmwareReleasesUseCase } from "./list-iot-firmware-releases";

const RELEASE = {
  version: "v1.3.0",
  name: null,
  publishedAt: "2026-08-01T10:00:00.000Z",
  prerelease: false,
  latest: true,
  notesHtml: null,
  releaseUrl: "https://github.com/org/repo/releases/tag/v1.3.0",
  assets: [],
};

describe("ListIotFirmwareReleasesUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListIotFirmwareReleasesUseCase;
  let githubPort: GithubPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(ListIotFirmwareReleasesUseCase);
    githubPort = testApp.module.get<GithubPort>(GITHUB_PORT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns the releases the port resolved for the family", async () => {
    vi.spyOn(githubPort, "listFirmwareReleases").mockResolvedValue(success([RELEASE]));

    const result = await useCase.execute("ambyte");

    assertSuccess(result);
    expect(result.value).toEqual([RELEASE]);
  });

  it("passes a port failure through untouched", async () => {
    vi.spyOn(githubPort, "listFirmwareReleases").mockResolvedValue(
      failure(AppError.notFound("No firmware repository is configured for minipar")),
    );

    const result = await useCase.execute("minipar");

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
