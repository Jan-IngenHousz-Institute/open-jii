import type { ConfigService } from "@nestjs/config";

import { MailchimpConfigService } from "./config.service";

const FULL_ENV: Record<string, string> = {
  "mailchimp.apiKey": "test-mailchimp-api-key",
  "mailchimp.serverPrefix": "us1",
  "mailchimp.audienceId": "test-audience-id",
  "mailchimp.community.kind": "group",
  "mailchimp.community.id": "test-community-interest-id",
  "mailchimp.community.name": "Community",
};

function makeService(values: Record<string, string | undefined>): MailchimpConfigService {
  const configService = {
    get: <T>(key: string): T | undefined => values[key] as T | undefined,
  } as unknown as ConfigService;
  return new MailchimpConfigService(configService);
}

describe("MailchimpConfigService", () => {
  describe("unconfigured", () => {
    it("boots without throwing when no Mailchimp env vars are present", () => {
      let service: MailchimpConfigService | undefined;
      expect(() => {
        service = makeService({});
      }).not.toThrow();
      expect(service?.isConfigured).toBe(false);
    });

    it("throws from value getters when accessed while unconfigured", () => {
      const service = makeService({});
      expect(() => service.apiKey).toThrow("Mailchimp is not configured");
    });
  });

  describe("configured", () => {
    it("is configured and exposes the values", () => {
      const service = makeService(FULL_ENV);

      expect(service.isConfigured).toBe(true);
      expect(service.apiKey).toBe(FULL_ENV["mailchimp.apiKey"]);
      expect(service.serverPrefix).toBe(FULL_ENV["mailchimp.serverPrefix"]);
      expect(service.audienceId).toBe(FULL_ENV["mailchimp.audienceId"]);
      expect(service.communityKind).toBe(FULL_ENV["mailchimp.community.kind"]);
      expect(service.communityId).toBe(FULL_ENV["mailchimp.community.id"]);
      expect(service.communityName).toBe(FULL_ENV["mailchimp.community.name"]);
    });

    it("derives the api base url from the server prefix", () => {
      const service = makeService(FULL_ENV);
      expect(service.baseUrl).toBe("https://us1.api.mailchimp.com/3.0");
    });

    it("accepts a merge field as the Community classification", () => {
      const service = makeService({
        ...FULL_ENV,
        "mailchimp.community.kind": "merge_field",
        "mailchimp.community.id": "MMERGE10",
      });

      expect(service.communityKind).toBe("merge_field");
      expect(service.communityId).toBe("MMERGE10");
      expect(service.communityName).toBe("Community");
    });
  });

  describe("misconfigured (partial/invalid)", () => {
    it("throws for an invalid community kind when other values are present", () => {
      expect(() => makeService({ ...FULL_ENV, "mailchimp.community.kind": "list" })).toThrow(
        "Mailchimp configuration validation failed",
      );
    });

    it("throws when configuration is partial (a required value is missing)", () => {
      const partial = { ...FULL_ENV };
      delete partial["mailchimp.audienceId"];
      expect(() => makeService(partial)).toThrow("Mailchimp configuration validation failed");
    });
  });
});
