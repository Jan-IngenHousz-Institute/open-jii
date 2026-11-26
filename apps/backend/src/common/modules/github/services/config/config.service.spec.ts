import type { ConfigService } from "@nestjs/config";

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
    expect(service.repositoryFor("co2dot")).toBe(process.env.FIRMWARE_REPO_CO2DOT);
  });

  it("treats a blank family as unconfigured rather than an empty repository", () => {
    // A blank setting must resolve to undefined so the route answers "not configured".
    const values: Record<string, unknown> = {
      "github.token": "",
      "github.firmwareRepositories": { minipar: "  ", co2dot: "Jan-IngenHousz-Institute/CO2Dot" },
    };
    const blank = new GithubConfigService({
      get: (key: string) => values[key],
    } as unknown as ConfigService);

    expect(blank.repositoryFor("minipar")).toBeUndefined();
    expect(blank.repositoryFor("co2dot")).toBe("Jan-IngenHousz-Institute/CO2Dot");
  });

  it("exposes the token as an empty string when unset", () => {
    expect(service.token).toBe(process.env.GITHUB_TOKEN ?? "");
  });
});
