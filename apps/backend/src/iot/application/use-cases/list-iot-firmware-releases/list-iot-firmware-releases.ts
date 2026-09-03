import { Inject, Injectable } from "@nestjs/common";

import type {
  FirmwareFamily,
  FirmwareRelease,
} from "@repo/api/domains/iot/firmware/iot-firmware.schema";

import type { Result } from "../../../../common/utils/fp-utils";
import { GITHUB_PORT } from "../../../core/ports/github.port";
import type { GithubPort } from "../../../core/ports/github.port";

@Injectable()
export class ListIotFirmwareReleasesUseCase {
  constructor(
    @Inject(GITHUB_PORT)
    private readonly githubPort: GithubPort,
  ) {}

  execute(family: FirmwareFamily): Promise<Result<FirmwareRelease[]>> {
    return this.githubPort.listFirmwareReleases(family);
  }
}
