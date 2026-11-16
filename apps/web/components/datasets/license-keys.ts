import type { DataLicense } from "@repo/api/domains/experiment/experiment.schema";

/** i18next reads dots as nesting, so the SPDX identifiers cannot be translation keys themselves. */
export const LICENSE_KEYS: Record<DataLicense, "cc0" | "ccBy" | "ccBySa"> = {
  "CC0-1.0": "cc0",
  "CC-BY-4.0": "ccBy",
  "CC-BY-SA-4.0": "ccBySa",
};
