import { z } from "zod";

import { zFirmwareFamily } from "@repo/api/domains/iot/firmware/iot-firmware.schema";

export interface GithubConfig {
  token: string;
  firmwareRepositories: Record<string, string>;
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
