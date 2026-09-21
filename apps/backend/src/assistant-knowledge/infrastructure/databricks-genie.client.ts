import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { DatabricksAuthService } from "../../common/modules/databricks/services/auth/auth.service";
import { DatabricksConfigService } from "../../common/modules/databricks/services/config/config.service";
import { AppError } from "../../common/utils/fp-utils";

interface GenieMessage {
  message_id: string;
  conversation_id: string;
  status: string;
  attachments?: {
    text?: { content?: string };
    query?: { description?: string; query?: string };
  }[];
  error?: { message?: string };
}

interface GenieStartResponse {
  message_id: string;
  conversation_id: string;
  message?: GenieMessage;
}

@Injectable()
export class DatabricksGenieClient {
  private readonly spaceId: string | null;
  private readonly publicDatasetConfirmed: boolean;

  constructor(
    configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly databricksAuth: DatabricksAuthService,
    private readonly databricksConfig: DatabricksConfigService,
  ) {
    this.spaceId = configService.get<string>("ASSISTANT_GENIE_SPACE_ID") ?? null;
    this.publicDatasetConfirmed =
      configService.get<string>("ASSISTANT_GENIE_PUBLIC_DATASET_CONFIRMED") === "true";
  }

  isConfigured(): boolean {
    return Boolean(this.spaceId && this.publicDatasetConfirmed);
  }

  async askPublicDataset(question: string): Promise<string> {
    if (!this.spaceId) {
      throw AppError.badRequest("Genie is not configured.", "GENIE_NOT_CONFIGURED");
    }
    if (!this.publicDatasetConfirmed) {
      throw AppError.forbidden(
        "Genie is disabled until its development dataset is explicitly confirmed public.",
        "GENIE_DATASET_NOT_PUBLIC",
      );
    }
    const tokenResult = await this.databricksAuth.getAccessToken();
    if (tokenResult.isFailure()) {
      throw AppError.internal(tokenResult.error.message, "DATABRICKS_AUTH_FAILED");
    }
    const base = `${this.databricksConfig.getHost()}/api/2.0/genie/spaces/${encodeURIComponent(this.spaceId)}`;
    const headers = {
      Authorization: `Bearer ${tokenResult.value}`,
      "Content-Type": "application/json",
    };
    const started = await this.httpService.axiosRef.post<GenieStartResponse>(
      `${base}/start-conversation`,
      { content: question },
      { headers, timeout: 30_000 },
    );
    let message =
      started.data.message ??
      ({
        message_id: started.data.message_id,
        conversation_id: started.data.conversation_id,
        status: "SUBMITTED",
      } satisfies GenieMessage);
    const terminalStates = new Set(["COMPLETED", "FAILED", "CANCELLED", "QUERY_RESULT_EXPIRED"]);
    for (let attempt = 0; attempt < 30 && !terminalStates.has(message.status); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const response = await this.httpService.axiosRef.get<GenieMessage>(
        `${base}/conversations/${encodeURIComponent(message.conversation_id)}/messages/${encodeURIComponent(message.message_id)}`,
        { headers, timeout: 30_000 },
      );
      message = response.data;
    }
    if (message.status !== "COMPLETED") {
      throw AppError.internal(
        message.error?.message ?? `Genie request ended with ${message.status}.`,
        "DOCUMENT_PARSE_FAILED",
      );
    }
    const text = message.attachments
      ?.map((attachment) => attachment.text?.content ?? attachment.query?.description ?? "")
      .filter(Boolean)
      .join("\n\n");
    if (!text) {
      throw AppError.internal("Genie returned no readable answer.", "DOCUMENT_PARSE_FAILED");
    }
    return text;
  }
}
