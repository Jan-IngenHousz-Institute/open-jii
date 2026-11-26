import { Injectable } from "@nestjs/common";

import type {
  FirmwareFamily,
  FirmwareRelease,
} from "@repo/api/domains/iot/firmware/iot-firmware.schema";

import { AppError, Result, failure } from "../../utils/fp-utils";
import { GithubConfigService } from "./services/config/config.service";
import { GithubReleasesService } from "./services/releases/releases.service";

/**
 * Firmware tag prefix for a repository that also publishes other release lines. The CO2Dot
 * repository releases its GUI (`gui/v*`) and hardware (`hw/v*`) beside its firmware
 * (`fw/v*`), so only `fw/` releases are firmware, and the version drops the prefix.
 */
const FIRMWARE_TAG_PREFIX: Partial<Record<FirmwareFamily, string>> = { co2dot: "fw/" };

/** Keep one release line and recompute `latest` within it. */
function firmwareLine(releases: FirmwareRelease[], prefix: string): FirmwareRelease[] {
  const line = releases.flatMap((release) =>
    release.version.startsWith(prefix)
      ? [{ ...release, version: release.version.slice(prefix.length) }]
      : [],
  );
  const latestStable = line.find((release) => !release.prerelease);
  return line.map((release) => ({ ...release, latest: release === latestStable }));
}

@Injectable()
export class GithubAdapter {
  constructor(
    private readonly githubConfig: GithubConfigService,
    private readonly releasesService: GithubReleasesService,
  ) {}

  async listFirmwareReleases(family: FirmwareFamily): Promise<Result<FirmwareRelease[]>> {
    const repository = this.githubConfig.repositoryFor(family);
    if (repository === undefined) {
      return failure(AppError.notFound(`No firmware repository is configured for ${family}`));
    }

    const prefix = FIRMWARE_TAG_PREFIX[family];
    const releases = await this.releasesService.listReleases(repository);
    return prefix === undefined ? releases : releases.map((list) => firmwareLine(list, prefix));
  }
}
