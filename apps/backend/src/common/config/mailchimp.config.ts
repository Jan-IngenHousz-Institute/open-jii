import { registerAs } from "@nestjs/config";

export default registerAs("mailchimp", () => ({
  apiKey: process.env.MAILCHIMP_API_KEY,
  serverPrefix: process.env.MAILCHIMP_SERVER_PREFIX,
  audienceId: process.env.MAILCHIMP_AUDIENCE_ID,
  community: {
    kind: process.env.MAILCHIMP_COMMUNITY_KIND,
    id: process.env.MAILCHIMP_COMMUNITY_ID,
    name: process.env.MAILCHIMP_COMMUNITY_NAME,
  },
}));
