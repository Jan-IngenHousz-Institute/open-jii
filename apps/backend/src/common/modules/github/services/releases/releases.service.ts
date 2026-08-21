import { HttpService } from "@nestjs/axios";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Cache } from "cache-manager";

import type { FirmwareRelease } from "@repo/api/domains/iot/firmware/iot-firmware.schema";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { ErrorCodes } from "../../../../utils/error-codes";
import { AppError, Result, success, tryCatch } from "../../../../utils/fp-utils";
import { GithubConfigService } from "../config/config.service";
import type { GithubReleasePayload } from "./releases.types";

const RELEASES_PER_PAGE = 20;

/**
 * Releases change on a human cadence, while the anonymous GitHub rate limit is
 * 60 requests per hour per IP. Caching belongs here rather than in the domain:
 * it protects this client's own budget, not a business rule.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_PREFIX = "github-releases:";

@Injectable()
export class GithubReleasesService {
  private readonly logger = new Logger(GithubReleasesService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly githubConfig: GithubConfigService,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  async listReleases(repository: string): Promise<Result<FirmwareRelease[]>> {
    const cacheKey = `${CACHE_PREFIX}${repository}`;
    const cached = await this.cache.get<FirmwareRelease[]>(cacheKey);
    if (cached) {
      return success(cached);
    }

    return tryCatch(
      async () => {
        const response = await this.httpService.axiosRef.get<GithubReleasePayload[]>(
          `https://api.github.com/repos/${repository}/releases`,
          {
            params: { per_page: RELEASES_PER_PAGE },
            headers: {
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
              ...(this.githubConfig.token === ""
                ? {}
                : { Authorization: `Bearer ${this.githubConfig.token}` }),
            },
          },
        );

        const releases = this.toReleases(response.data);
        await this.cache.set(cacheKey, releases, CACHE_TTL_MS);
        return releases;
      },
      (error) => {
        this.logger.error({
          msg: "Failed to list firmware releases",
          operation: "listReleases",
          repository,
          error: getAxiosErrorMessage(error),
        });
        return AppError.internal(
          `Could not read releases for ${repository}`,
          ErrorCodes.GITHUB_RELEASES_FAILED,
        );
      },
    );
  }

  /**
   * Drafts are invisible to devices, so they are dropped rather than shown as
   * unavailable. `latest` marks the newest published stable release, matching
   * what a rollout defaulting to `latest` would actually pick.
   */
  private toReleases(payload: GithubReleasePayload[]): FirmwareRelease[] {
    const published = payload.flatMap((release) =>
      release.draft || release.published_at === null
        ? []
        : [{ ...release, publishedAt: release.published_at }],
    );
    const latestStable = published.find((release) => !release.prerelease);

    return published.map((release) => ({
      version: release.tag_name,
      name: release.name,
      publishedAt: new Date(release.publishedAt).toISOString(),
      prerelease: release.prerelease,
      latest: release === latestStable,
      notes: release.body,
      releaseUrl: release.html_url,
      assets: release.assets.map((asset) => ({
        name: asset.name,
        sizeBytes: asset.size,
        downloadUrl: asset.browser_download_url,
      })),
    }));
  }
}
