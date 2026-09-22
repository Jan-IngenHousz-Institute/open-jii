import { z } from "zod";

import { zSensorFamily } from "../../protocol/protocol.schema";

/**
 * Families whose firmware JII builds and publishes. Phones run app releases and
 * generic devices are third-party, so neither has a JII firmware line.
 */
export const zFirmwareFamily = zSensorFamily.exclude(["mobile", "generic", "multispeq"]);

export const zFirmwareReleaseAsset = z.object({
  name: z.string(),
  sizeBytes: z.number().int(),
  downloadUrl: z.string().url(),
});

export const zFirmwareRelease = z.object({
  version: z.string().describe("Release tag, e.g. v1.3.0"),
  name: z.string().nullable(),
  publishedAt: z.string().datetime(),
  prerelease: z.boolean(),
  /** The newest published, non-prerelease release; at most one per response. */
  latest: z.boolean(),
  /** The release body as GitHub's own sanitized HTML rendering of it. */
  notesHtml: z.string().nullable(),
  releaseUrl: z.string().url(),
  assets: z.array(zFirmwareReleaseAsset),
});

export const zFirmwareReleaseList = z.object({
  releases: z.array(zFirmwareRelease),
});

export const zFirmwareFamilyPathParam = z.object({
  family: zFirmwareFamily,
});

export type FirmwareFamily = z.infer<typeof zFirmwareFamily>;
export type FirmwareRelease = z.infer<typeof zFirmwareRelease>;
export type FirmwareReleaseAsset = z.infer<typeof zFirmwareReleaseAsset>;
export type FirmwareReleaseList = z.infer<typeof zFirmwareReleaseList>;
