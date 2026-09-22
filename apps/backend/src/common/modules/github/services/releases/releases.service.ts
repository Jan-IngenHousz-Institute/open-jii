import { HttpService } from "@nestjs/axios";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Cache } from "cache-manager";

import type { FirmwareRelease } from "@repo/api/domains/iot/firmware/iot-firmware.schema";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { ErrorCodes } from "../../../../utils/error-codes";
import { AppError, Result, failure, success, tryCatch } from "../../../../utils/fp-utils";
import { GithubConfigService } from "../config/config.service";
import type { GithubReleasePayload } from "./releases.types";

const RELEASES_PER_PAGE = 20;

/**
 * Releases change on a human cadence, while the anonymous GitHub rate limit is
 * 60 requests per hour per shared egress IP. Caching belongs here rather than
 * in the domain: it protects this client's own budget, not a business rule.
 *
 * An entry is served without asking GitHub for FRESH_MS, kept as a fallback
 * until CACHE_TTL_MS, and a repository that just failed is not retried for
 * FAILURE_TTL_MS. Without that last part one unreadable repository (a typo, a
 * private repo) would burn the whole hourly budget and take the working
 * families down with it.
 *
 * FRESH_MS is sized against that budget rather than against how fresh the data
 * needs to be: the cache is per task, so the worst case is
 * (60 / FRESH_MS_minutes) x tasks x repositories requests an hour. At five
 * minutes, three tasks and three families that is 108, well over the limit. At
 * fifteen it is 36. Releases move on a human cadence, so the staleness costs
 * nothing.
 */
const FRESH_MS = 15 * 60 * 1000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const FAILURE_TTL_MS = 60 * 1000;
const CACHE_PREFIX = "github-releases:";
const FAILURE_PREFIX = "github-releases-failed:";

interface CachedReleases {
  releases: FirmwareRelease[];
  fetchedAt: number;
}

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
    const cached = await this.readCache<CachedReleases>(`${CACHE_PREFIX}${repository}`);
    if (cached && Date.now() - cached.fetchedAt < FRESH_MS) {
      return success(cached.releases);
    }

    if (await this.readCache<true>(`${FAILURE_PREFIX}${repository}`)) {
      return this.staleOr(cached, repository, "recently failed");
    }

    const fetched = await tryCatch(
      async () => {
        const response = await this.httpService.axiosRef.get<GithubReleasePayload[]>(
          `https://api.github.com/repos/${repository}/releases`,
          {
            params: { per_page: RELEASES_PER_PAGE },
            headers: {
              // full: GitHub also renders the body to sanitized HTML server-side, so
              // the platform shows real release notes without a markdown stack.
              Accept: "application/vnd.github.full+json",
              "X-GitHub-Api-Version": "2022-11-28",
              ...(this.githubConfig.token === ""
                ? {}
                : { Authorization: `Bearer ${this.githubConfig.token}` }),
            },
          },
        );

        const releases = this.toReleases(response.data);
        await this.writeCache(
          `${CACHE_PREFIX}${repository}`,
          { releases, fetchedAt: Date.now() },
          CACHE_TTL_MS,
        );
        return releases;
      },
      (error) => {
        this.logger.error({
          msg: "Failed to list firmware releases",
          operation: "listReleases",
          repository,
          error: getAxiosErrorMessage(error),
        });
        // An unreadable repository is a configuration gap, not a platform
        // fault: it reads the same as a family nobody publishes for.
        return AppError.notFound(
          `Could not read releases for ${repository}`,
          ErrorCodes.GITHUB_RELEASES_FAILED,
        );
      },
    );

    if (fetched.isSuccess()) {
      return fetched;
    }

    await this.writeCache(`${FAILURE_PREFIX}${repository}`, true, FAILURE_TTL_MS);
    return this.staleOr(cached, repository, "refresh failed");
  }

  /** Last good answer beats an error the caller can do nothing about. */
  private staleOr(
    cached: CachedReleases | undefined,
    repository: string,
    reason: string,
  ): Result<FirmwareRelease[]> {
    if (cached) {
      this.logger.warn({
        msg: "Serving stale firmware releases",
        operation: "listReleases",
        repository,
        reason,
      });
      return success(cached.releases);
    }

    return failure(
      AppError.notFound(
        `Could not read releases for ${repository}`,
        ErrorCodes.GITHUB_RELEASES_FAILED,
      ),
    );
  }

  /** A cache outage degrades to a miss rather than failing the request. */
  private async readCache<T>(key: string): Promise<T | undefined> {
    try {
      return (await this.cache.get<T>(key)) ?? undefined;
    } catch (error) {
      this.logger.warn({ msg: "Cache read failed, treating as miss", key, error });
      return undefined;
    }
  }

  private async writeCache(key: string, value: unknown, ttlMs: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttlMs);
    } catch (error) {
      this.logger.warn({ msg: "Cache write failed", key, error });
    }
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
      notesHtml: release.body_html ?? null,
      releaseUrl: release.html_url,
      assets: release.assets.map((asset) => ({
        name: asset.name,
        sizeBytes: asset.size,
        downloadUrl: asset.browser_download_url,
      })),
    }));
  }
}
