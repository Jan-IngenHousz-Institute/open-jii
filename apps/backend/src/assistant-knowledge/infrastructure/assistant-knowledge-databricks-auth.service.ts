import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { DatabricksAuthService } from "../../common/modules/databricks/services/auth/auth.service";
import { DatabricksConfigService } from "../../common/modules/databricks/services/config/config.service";
import type { Result } from "../../common/utils/fp-utils";
import { AppError, failure, success } from "../../common/utils/fp-utils";

const execFileAsync = promisify(execFile);

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed?.length ? trimmed : undefined;
}

export const ASSISTANT_KNOWLEDGE_DEV_HOST = "https://dbc-6efd58ae-21b6.cloud.databricks.com";

@Injectable()
export class AssistantKnowledgeDatabricksAuthService extends DatabricksAuthService {
  private cliToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly environment: ConfigService,
    private readonly databricksConfig: DatabricksConfigService,
    http: HttpService,
  ) {
    super(databricksConfig, http);
  }

  override async getAccessToken(): Promise<Result<string>> {
    if (this.environment.get<string>("ASSISTANT_KNOWLEDGE_AUTH") !== "cli") {
      return super.getAccessToken();
    }
    if (
      process.env.NODE_ENV === "production" ||
      this.databricksConfig.getHost().replace(/\/$/u, "") !== ASSISTANT_KNOWLEDGE_DEV_HOST
    ) {
      return failure(
        AppError.forbidden(
          "Assistant knowledge CLI authentication is restricted to the pinned development workspace",
          "DATABRICKS_AUTH_FAILED",
        ),
      );
    }
    if (this.cliToken && this.cliToken.expiresAt > Date.now() + 60_000) {
      return success(this.cliToken.value);
    }

    const cliPath =
      nonEmpty(this.environment.get<string>("ASSISTANT_KNOWLEDGE_DATABRICKS_CLI_PATH")) ??
      "databricks";
    const profile =
      nonEmpty(this.environment.get<string>("ASSISTANT_KNOWLEDGE_DATABRICKS_PROFILE")) ??
      nonEmpty(this.environment.get<string>("ASSISTANT_DATABRICKS_PROFILE")) ??
      "DEFAULT";
    try {
      const { stdout } = await execFileAsync(
        cliPath,
        [
          "auth",
          "token",
          "--host",
          ASSISTANT_KNOWLEDGE_DEV_HOST,
          "--profile",
          profile,
          "--output",
          "json",
        ],
        { timeout: 15_000, maxBuffer: 64 * 1024 },
      );
      const parsed = JSON.parse(stdout) as { access_token?: unknown; expiry?: unknown };
      if (typeof parsed.access_token !== "string" || parsed.access_token.length === 0) {
        throw new Error("missing token");
      }
      const parsedExpiry =
        typeof parsed.expiry === "string" ? Date.parse(parsed.expiry) : Number.NaN;
      this.cliToken = {
        value: parsed.access_token,
        expiresAt: Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + 10 * 60_000,
      };
      return success(parsed.access_token);
    } catch {
      return failure(
        AppError.unauthorized(
          "Databricks development login is unavailable for assistant knowledge",
          "DATABRICKS_AUTH_FAILED",
        ),
      );
    }
  }
}
