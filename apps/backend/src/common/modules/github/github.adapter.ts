import { Injectable } from "@nestjs/common";

import type {
  FirmwareFamily,
  FirmwareRelease,
} from "@repo/api/domains/iot/firmware/iot-firmware.schema";

import { AppError, Result, failure } from "../../utils/fp-utils";
import { GithubConfigService } from "./services/config/config.service";
import { GithubReleasesService } from "./services/releases/releases.service";

@Injectable()
export class GithubAdapter {
  constructor(
    private readonly githubConfig: GithubConfigService,
    private readonly releasesService: GithubReleasesService,
  ) {}

  listFirmwareReleases(family: FirmwareFamily): Promise<Result<FirmwareRelease[]>> {
    const repository = this.githubConfig.repositoryFor(family);
    if (repository === undefined) {
      return Promise.resolve(
        failure(AppError.notFound(`No firmware repository is configured for ${family}`)),
      );
    }

    return this.releasesService.listReleases(repository);
  }
}
