import type { PlatformEnv } from "./platform-url";
import { PLATFORM_ENV } from "./platform-url";

// Recommended starter workbooks are seeded separately in each environment, so
// the same workbook has a different id in dev and prod. Keyed by a stable slug
// used from content; add environments/ids here rather than in MDX.
const STARTER_WORKBOOK_IDS: Partial<Record<string, Record<PlatformEnv, string>>> = {
  "photosynthesis-rides-2-1": {
    prod: "1156d46f-acb5-4bd2-914a-636a6b66e95e",
    dev: "37a8aeeb-b0a5-4c7b-9324-2644bb060621",
  },
  "unza-pirk-dirk-light-potential-14": {
    prod: "25a05d48-1996-4953-af08-a4ba80bf360c",
    dev: "8285b4f6-7efa-437d-84af-c2b89646d58b",
  },
};

// Platform path (origin-less) for a starter workbook in the current environment.
// Throws at build time if the slug is unknown, so a bad reference fails the
// docs build instead of shipping a broken link.
export function starterWorkbookPath(slug: string): string {
  const ids = STARTER_WORKBOOK_IDS[slug];
  if (!ids) {
    throw new Error(`Unknown starter workbook slug "${slug}"`);
  }
  return `/en-US/platform/workbooks/${ids[PLATFORM_ENV]}`;
}
