import type {
  FirmwareFamily,
  FirmwareRelease,
} from "@repo/api/domains/iot/firmware/iot-firmware.schema";

import type { Result } from "../../../common/utils/fp-utils";

export const GITHUB_PORT = Symbol("GITHUB_PORT");

export interface GithubPort {
  listFirmwareReleases(family: FirmwareFamily): Promise<Result<FirmwareRelease[]>>;
}
