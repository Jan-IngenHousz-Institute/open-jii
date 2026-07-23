import type { PlatformEnv } from "./platform-url";
import { PLATFORM_ENV } from "./platform-url";

// Recommended starter workbooks are seeded separately in each environment, so
// the same workbook has a different id in dev and prod. Keyed by a stable slug.
// A slug may omit an environment; when the current environment has no id the
// link falls back to the workbook library instead of a known-broken record.
const STARTER_WORKBOOK_IDS: Partial<Record<string, Partial<Record<PlatformEnv, string>>>> = {
  "photosynthesis-rides-2-1": {
    prod: "1156d46f-acb5-4bd2-914a-636a6b66e95e",
    dev: "37a8aeeb-b0a5-4c7b-9324-2644bb060621",
  },
  "unza-pirk-dirk-light-potential-14": {
    prod: "25a05d48-1996-4953-af08-a4ba80bf360c",
    dev: "8285b4f6-7efa-437d-84af-c2b89646d58b",
  },
};

// Workbook library for the current environment; the fallback destination when a
// starter workbook is not configured for this environment.
export const WORKBOOK_LIBRARY_PATH = "/en-US/platform/workbooks";

export interface StarterWorkbookTarget {
  path: string;
  // True when the specific workbook is not configured for the current
  // environment and the link falls back to the workbook library.
  isFallback: boolean;
}

// Resolve a starter workbook to a platform path for the current environment.
// Throws on an unknown slug (author typo, caught at build time). When the slug
// is known but has no id for this environment, returns the workbook library so
// the link is never broken and never points at another environment.
export function resolveStarterWorkbook(slug: string): StarterWorkbookTarget {
  const ids = STARTER_WORKBOOK_IDS[slug];
  if (!ids) {
    throw new Error(`Unknown starter workbook slug "${slug}"`);
  }
  const id = ids[PLATFORM_ENV];
  if (!id) {
    return { path: WORKBOOK_LIBRARY_PATH, isFallback: true };
  }
  return { path: `/en-US/platform/workbooks/${id}`, isFallback: false };
}
