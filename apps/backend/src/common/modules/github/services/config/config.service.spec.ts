import { TestHarness } from "../../../../../test/test-harness";
import { GithubConfigService } from "./config.service";

describe("GithubConfigService", () => {
  const testApp = TestHarness.App;
  let service: GithubConfigService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(GithubConfigService);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("resolves the configured repository per family", () => {
    expect(service.repositoryFor("ambyte")).toBe(process.env.FIRMWARE_REPO_AMBYTE);
    expect(service.repositoryFor("ambit")).toBe(process.env.FIRMWARE_REPO_AMBIT);
    expect(service.repositoryFor("minipar")).toBe(process.env.FIRMWARE_REPO_MINIPAR);
  });

  it("exposes the token as an empty string when unset", () => {
    expect(service.token).toBe(process.env.GITHUB_TOKEN ?? "");
  });
});
