import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { AssistantToolCall } from "@repo/api/domains/assistant/assistant.schema";

import { DatabricksAuthService } from "../../common/modules/databricks/services/auth/auth.service";
import { AppError } from "../../common/utils/fp-utils";
import { SYSTEM_PROMPT, TOOLS } from "./assistant-model.contract";

interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AgentToolRequest {
  id: string;
  name: string;
  arguments: unknown;
}

interface AgentUsage {
  inputTokens?: number;
  outputTokens?: number;
}

interface AgentUsageDetails {
  usage: AgentUsage;
  usageComplete: boolean;
}

type AgentTurnResponse =
  | {
      status: "tool_requests";
      continuationToken: string;
      requests: AgentToolRequest[];
      usage: AgentUsage;
      usageComplete?: boolean;
    }
  | {
      status: "completed";
      content: string;
      usage: AgentUsage;
      usageComplete?: boolean;
      stopReason: string;
    };

export interface AssistantToolResult {
  modelResult: unknown;
  toolCall: AssistantToolCall;
}

export interface AssistantModelRun {
  content: string;
  toolCalls: AssistantToolCall[];
  inputTokens: number;
  outputTokens: number;
  usageComplete: boolean;
}

type ExecuteTool = (name: string, args: unknown, callId: string) => Promise<AssistantToolResult>;

@Injectable()
export class AssistantModelService {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly databricksAuth: DatabricksAuthService,
  ) {}

  async run(
    history: { role: "user" | "assistant"; content: string }[],
    executeTool: ExecuteTool,
    options?: { maxOutputTokens?: number; maxTotalTokens?: number },
  ): Promise<AssistantModelRun> {
    if (!this.config.get<string>("assistant.agentUrl")) {
      throw AppError.internal(
        "Assistant agent is not configured",
        "PROVIDER_UNAVAILABLE",
        this.usageDetails({}, false),
      );
    }
    return this.runAgent(history, executeTool, options);
  }

  private async runAgent(
    history: { role: "user" | "assistant"; content: string }[],
    executeTool: ExecuteTool,
    options?: { maxOutputTokens?: number; maxTotalTokens?: number },
  ): Promise<AssistantModelRun> {
    const messages = this.modelMessages(history);
    const baseUrl = this.config.getOrThrow<string>("assistant.agentUrl").replace(/\/$/, "");
    const maxRounds = this.positiveConfig("assistant.maxToolRounds", 4);
    const toolCalls: AssistantToolCall[] = [];
    let response = await this.agentRequest(`${baseUrl}/v1/agent/turns`, {
      protocolVersion: 1,
      model: this.config.getOrThrow<string>("assistant.modelEndpoint"),
      messages,
      tools: TOOLS,
      limits: {
        maxToolRounds: Math.min(maxRounds, 4),
        maxTotalTokens: Math.min(options?.maxTotalTokens ?? 100_000, 100_000),
        maxOutputTokens: Math.min(
          options?.maxOutputTokens ?? this.positiveConfig("assistant.maxOutputTokens", 2_000),
          8_192,
        ),
        maxToolCallsPerRound: 8,
      },
    });

    for (let round = 0; round <= maxRounds; round += 1) {
      if (response.status === "completed") {
        const content = response.content.trim();
        if (!content || response.stopReason !== "stop") {
          throw AppError.internal(
            "Assistant agent returned an invalid completion",
            "PROVIDER_INVALID_RESPONSE",
            this.usageDetails(response.usage, response.usageComplete === true),
          );
        }
        return {
          content,
          toolCalls,
          inputTokens: response.usage.inputTokens ?? 0,
          outputTokens: response.usage.outputTokens ?? 0,
          usageComplete: response.usageComplete === true,
        };
      }
      if (round === maxRounds || response.requests.length > 8) {
        throw AppError.badRequest(
          "The assistant reached its tool-call limit before finishing",
          "TOOL_LOOP_LIMIT",
          this.usageDetails(response.usage, response.usageComplete === true),
        );
      }
      const requestIds = new Set<string>();
      const results: {
        id: string;
        name: string;
        status: "completed" | "failed";
        result?: unknown;
        error?: string;
      }[] = [];
      for (const request of response.requests) {
        if (!request.id || !request.name || requestIds.has(request.id)) {
          throw AppError.internal(
            "Assistant agent returned invalid tool requests",
            "PROVIDER_INVALID_RESPONSE",
            this.usageDetails(response.usage, response.usageComplete === true),
          );
        }
        requestIds.add(request.id);
        const result = await executeTool(request.name, request.arguments, request.id);
        toolCalls.push(result.toolCall);
        results.push({
          id: request.id,
          name: request.name,
          status: result.toolCall.status,
          ...(result.toolCall.status === "completed"
            ? { result: result.modelResult }
            : { error: result.toolCall.error ?? result.toolCall.summary }),
        });
      }
      response = await this.agentRequest(`${baseUrl}/v1/agent/turns/continue`, {
        protocolVersion: 1,
        continuationToken: response.continuationToken,
        results,
      });
    }
    throw AppError.badRequest(
      "The assistant could not finish this turn",
      "TOOL_LOOP_LIMIT",
      this.usageDetails(response.usage, response.usageComplete === true),
    );
  }

  private async agentRequest(url: string, body: unknown): Promise<AgentTurnResponse> {
    const destination = this.agentDestination(url);
    const gatewayToken = this.config.get<string>("assistant.gatewayToken");
    if (!gatewayToken) {
      throw AppError.internal(
        "Assistant agent is configured without ASSISTANT_GATEWAY_TOKEN",
        "PROVIDER_UNAVAILABLE",
      );
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-OpenJII-Gateway-Key": gatewayToken,
    };
    if (!destination.loopback) {
      const accessToken = await this.databricksAuth.getAccessToken();
      if (accessToken.isFailure()) throw accessToken.error;
      headers.Authorization = `Bearer ${accessToken.value}`;
    }
    try {
      const response = await this.http.axiosRef.post<unknown>(url, body, {
        headers,
        timeout: 120_000,
        maxBodyLength: 2 * 1024 * 1024,
        maxContentLength: 2 * 1024 * 1024,
      });
      const data = response.data;
      if (!this.isAgentTurnResponse(data)) {
        throw AppError.internal(
          "Assistant agent returned an invalid response",
          "PROVIDER_INVALID_RESPONSE",
          this.usageDetails({}, false),
        );
      }
      return data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      const details = this.agentError(error);
      throw AppError.internal(details.message, details.code, {
        usage: details.usage,
        usageComplete: details.usageComplete,
      });
    }
  }

  private agentError(error: unknown): {
    code: string;
    message: string;
    usage: AgentUsage;
    usageComplete: boolean;
  } {
    if (typeof error === "object" && error !== null && "response" in error) {
      const response = (error as { response?: { data?: unknown } }).response;
      const data = response?.data as
        | {
            detail?: {
              code?: unknown;
              message?: unknown;
              usage?: unknown;
              usageComplete?: unknown;
            };
          }
        | undefined;
      if (typeof data?.detail?.code === "string" && typeof data.detail.message === "string") {
        return {
          code: data.detail.code,
          message: data.detail.message,
          usage: this.isAgentUsage(data.detail.usage) ? data.detail.usage : {},
          usageComplete: data.detail.usageComplete === true,
        };
      }
    }
    return {
      code: "PROVIDER_UNAVAILABLE",
      message: "Assistant agent is unavailable",
      usage: {},
      usageComplete: false,
    };
  }

  private modelMessages(
    history: { role: "user" | "assistant"; content: string }[],
  ): ModelMessage[] {
    return [
      { role: "system", content: SYSTEM_PROMPT },
      ...history
        .slice(-99)
        .map((message): ModelMessage => ({ role: message.role, content: message.content })),
    ];
  }

  private isAgentTurnResponse(value: unknown): value is AgentTurnResponse {
    if (typeof value !== "object" || value === null || !("status" in value)) return false;
    const response = value as Record<string, unknown>;
    if (!this.isAgentUsage(response.usage)) return false;
    if (response.usageComplete !== undefined && typeof response.usageComplete !== "boolean") {
      return false;
    }
    if (response.status === "completed") {
      return typeof response.content === "string" && typeof response.stopReason === "string";
    }
    if (response.status !== "tool_requests") return false;
    if (typeof response.continuationToken !== "string" || !Array.isArray(response.requests)) {
      return false;
    }
    return response.requests.every((request: unknown) => {
      if (typeof request !== "object" || request === null) return false;
      const toolRequest = request as Record<string, unknown>;
      return (
        typeof toolRequest.id === "string" &&
        typeof toolRequest.name === "string" &&
        "arguments" in toolRequest
      );
    });
  }

  private isAgentUsage(value: unknown): value is AgentUsage {
    if (typeof value !== "object" || value === null) return false;
    const usage = value as Record<string, unknown>;
    return [usage.inputTokens, usage.outputTokens].every(
      (tokens) =>
        tokens === undefined ||
        (typeof tokens === "number" && Number.isInteger(tokens) && tokens >= 0),
    );
  }

  private positiveConfig(key: string, fallback: number): number {
    const value = this.config.get<number>(key);
    return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
  }

  private agentDestination(value: string): { loopback: boolean } {
    try {
      const url = new URL(value);
      if (url.username || url.password || url.search || url.hash) throw new Error("unsafe URL");
      const loopback = ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
      if (loopback && (url.protocol === "http:" || url.protocol === "https:")) {
        return { loopback: true };
      }
      const trustedHost = this.config
        .get<string>("assistant.trustedAgentHost")
        ?.trim()
        .toLowerCase();
      if (
        url.protocol === "https:" &&
        url.port === "" &&
        trustedHost &&
        url.hostname.toLowerCase() === trustedHost
      ) {
        return { loopback: false };
      }
    } catch {
      // Fall through to the same fail-closed error for malformed and untrusted URLs.
    }
    throw AppError.internal(
      "Assistant agent URL is not an approved destination",
      "PROVIDER_UNAVAILABLE",
      this.usageDetails({}, false),
    );
  }

  private usageDetails(usage: AgentUsage, usageComplete: boolean): AgentUsageDetails {
    return { usage, usageComplete };
  }
}
