import { z } from "zod";

import type { FirmwareFamily } from "@repo/api/domains/iot/firmware/iot-firmware.schema";
import { zFirmwareFamily } from "@repo/api/domains/iot/firmware/iot-firmware.schema";

export type FirmwareRepositories = Partial<Record<FirmwareFamily, string>>;

export interface GithubConfig {
  token: string;
  firmwareRepositories: FirmwareRepositories;
}

const zRepository = z
  .string()
  .regex(/^[\w.-]+\/[\w.-]+$/, "expected an owner/repo slug")
  .optional();

export const githubConfigSchema = z.object({
  // Optional: the firmware repositories are public and readable anonymously.
  token: z.string(),
  firmwareRepositories: z.record(zFirmwareFamily, zRepository),
});
