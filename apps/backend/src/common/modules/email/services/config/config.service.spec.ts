import { ConfigService } from "@nestjs/config";

import { TestHarness } from "../../../../../test/test-harness";
import { EmailConfigService } from "./config.service";

describe("EmailConfigService", () => {
  const testApp = TestHarness.App;
  let configService: EmailConfigService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    configService = testApp.module.get(EmailConfigService);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("getConfig", () => {
    it("should return the config with all expected properties", () => {
      const config = configService.getConfig();

      // Verify the returned config has all required properties
      expect(config).toBeDefined();
      expect(config.server).toBeDefined();
      expect(config.from).toBeDefined();
    });
  });

  describe("validateConfig", () => {
    it("should throw an error if the config is invalid", () => {
      // Mock the ConfigService to return an empty string for a required value
      const configService = testApp.module.get(ConfigService);
      const getOrThrowSpy = vi
        .spyOn(configService, "getOrThrow")
        .mockImplementation((key: string) => {
          if (key === "email.server") {
            return "";
          }

          return "valid_string";
        });

      expect(() => new EmailConfigService(configService)).toThrow(
        "Invalid Email configuration: all fields must be non-empty strings",
      );

      getOrThrowSpy.mockRestore();
    });
  });

  describe("getter methods", () => {
    it("should return the correct base Url", () => {
      const baseUrl = configService.getBaseUrl();
      expect(baseUrl).toBe(process.env.EMAIL_BASE_URL);
    });

    it("should return the correct server", () => {
      const server = configService.getServer();
      expect(server).toBe(process.env.EMAIL_SERVER);
    });

    it("should return the correct from address", () => {
      const from = configService.getFrom();
      expect(from).toBe(process.env.EMAIL_FROM);
    });
  });
});
