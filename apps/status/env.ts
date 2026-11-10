import { z } from "zod/mini";

const envSchema = z.object({
  // Only deploys that know their public address set it; the rest leave metadata URLs relative.
  STATUS_BASE_URL: z.optional(z.url()),
  // Crawling stays blocked unless the deploy opts in (prod only), so dev and local builds are never indexed.
  STATUS_INDEXABLE: z._default(z.enum(["true", "false"]), "false"),
  // Where `next dev` proxies /data from: dev's live file by default, or `pnpm status:fixtures`.
  STATUS_DATA_ORIGIN: z._default(z.url(), "https://status.dev.openjii.org"),
});

export const env = envSchema.parse({
  STATUS_BASE_URL: process.env.STATUS_BASE_URL,
  STATUS_INDEXABLE: process.env.STATUS_INDEXABLE,
  STATUS_DATA_ORIGIN: process.env.STATUS_DATA_ORIGIN,
});
