import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import mailchimpConfig from "../../config/mailchimp.config";
import { MailchimpConfigService } from "./config/config.service";
import { MailchimpModule } from "./mailchimp.module";

// Guards the boot regression: on environments with no Mailchimp secrets the
// module must still compile so the rest of the backend serves normally.
describe("MailchimpModule boot without configuration", () => {
  const ENV_KEYS = [
    "MAILCHIMP_API_KEY",
    "MAILCHIMP_SERVER_PREFIX",
    "MAILCHIMP_AUDIENCE_ID",
    "MAILCHIMP_COMMUNITY_KIND",
    "MAILCHIMP_COMMUNITY_ID",
    "MAILCHIMP_COMMUNITY_NAME",
  ];
  const saved: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] !== undefined) {
        process.env[key] = saved[key];
      }
    }
  });

  it("compiles the module and reports itself unconfigured", async () => {
    // compile() rejecting (the old getOrThrow crash) would fail this test.
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [mailchimpConfig] }),
        MailchimpModule,
      ],
    }).compile();

    const config = moduleRef.get(MailchimpConfigService);
    expect(config.isConfigured).toBe(false);

    await moduleRef.close();
  });
});
