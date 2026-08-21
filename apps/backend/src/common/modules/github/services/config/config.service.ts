import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { FirmwareFamily } from "@repo/api/domains/iot/firmware/iot-firmware.schema";

import { GithubConfig, githubConfigSchema } from "./config.types";

@Injectable()
export class GithubConfigService {
  private readonly logger = new Logger(GithubConfigService.name);
  private readonly config: GithubConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      token: this.configService.get<string>("github.token") ?? "",
      firmwareRepositories: this.readRepositories(),
    };
    githubConfigSchema.parse(this.config);
  }

  private readRepositories(): Record<string, string> {
    const configured =
      this.configService.get<Record<string, string | undefined>>("github.firmwareRepositories") ??
      {};

    return Object.fromEntries(
      Object.entries(configured).flatMap(([family, repository]) =>
        repository === undefined || repository.trim() === "" ? [] : [[family, repository.trim()]],
      ),
    );
  }

  get token(): string {
    return this.config.token;
  }

  /** The repository publishing a family's firmware; absent when unconfigured. */
  repositoryFor(family: FirmwareFamily): string | undefined {
    return this.config.firmwareRepositories[family];
  }
}
