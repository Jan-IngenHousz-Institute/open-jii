import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import type { InvokeCommandInput } from "@aws-sdk/client-lambda";
import { Injectable } from "@nestjs/common";
import * as zlib from "node:zlib";

import { ErrorCodes } from "../../../../utils/error-codes";
import type { Result } from "../../../../utils/fp-utils";
import { tryCatch, AppError } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";
import type { InvokeLambdaRequest, InvokeLambdaResponse } from "./lambda.types";

@Injectable()
export class AwsLambdaService {
  private readonly lambdaClient: LambdaClient;
  private readonly endpointClients = new Map<string, LambdaClient>();

  // Hard cap on decompressed Lambda response.
  private static readonly MAX_DECOMPRESSED_BYTES = 50 * 1024 * 1024;

  constructor(private readonly configService: AwsConfigService) {
    this.lambdaClient = new LambdaClient({
      region: this.configService.region,
      maxAttempts: 5,
    });
  }

  /**
   * Invoke a Lambda function with a JSON payload
   */
  async invoke<TPayload = Record<string, unknown>>(
    request: InvokeLambdaRequest,
  ): Promise<Result<InvokeLambdaResponse<TPayload>>> {
    const { functionName, payload, invocationType = "RequestResponse", endpoint } = request;

    return tryCatch(
      async () => {
        const input: InvokeCommandInput = {
          FunctionName: functionName,
          InvocationType: invocationType,
          Payload: new TextEncoder().encode(JSON.stringify(payload)),
        };

        const command = new InvokeCommand(input);
        const response = await this.clientFor(endpoint).send(command);

        const rawPayload: unknown = response.Payload
          ? JSON.parse(new TextDecoder().decode(response.Payload))
          : {};

        const responsePayload = this.maybeDecompress(rawPayload) as TPayload;

        if (response.FunctionError) {
          throw AppError.internal(
            `Lambda function error: ${response.FunctionError}`,
            ErrorCodes.AWS_OPERATION_FAILED,
          );
        }

        return {
          statusCode: response.StatusCode ?? 200,
          payload: responsePayload,
          functionError: response.FunctionError,
        };
      },
      (error) => this.describeInvokeError(error, endpoint),
    );
  }

  /**
   * A local runtime interface emulator never throttles and ignores the request
   * signature, so its client makes one attempt with placeholder credentials: a
   * real access key must never reach a container that runs user-authored code.
   */
  private clientFor(endpoint: string | undefined): LambdaClient {
    if (!endpoint) {
      return this.lambdaClient;
    }

    const existing = this.endpointClients.get(endpoint);
    if (existing) {
      return existing;
    }

    const client = new LambdaClient({
      region: this.configService.region,
      endpoint,
      maxAttempts: 1,
      credentials: { accessKeyId: "local", secretAccessKey: "local" },
    });
    this.endpointClients.set(endpoint, client);
    return client;
  }

  private describeInvokeError(error: unknown, endpoint: string | undefined): AppError {
    if (error instanceof AppError) {
      return error;
    }

    const refusedByLocalEndpoint = endpoint !== undefined && this.isConnectionRefused(error);
    if (refusedByLocalEndpoint) {
      return AppError.internal(
        `Lambda endpoint ${endpoint} refused the connection; is the local container running?`,
        ErrorCodes.AWS_OPERATION_FAILED,
      );
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return AppError.internal(errorMessage, ErrorCodes.AWS_OPERATION_FAILED);
  }

  private isConnectionRefused(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ECONNREFUSED"
    );
  }

  /**
   * Lambda handlers compress responses as `{encoding: "gzip+base64", payload}`
   * to bypass AWS Lambda's 6 MB sync-response cap.
   */
  private maybeDecompress(payload: unknown): unknown {
    if (payload === null || typeof payload !== "object") {
      return payload;
    }
    const record = payload as Record<string, unknown>;
    if (record.encoding !== "gzip+base64" || typeof record.payload !== "string") {
      return payload;
    }
    const compressed = Buffer.from(record.payload, "base64");
    const decompressed = zlib.gunzipSync(compressed, {
      maxOutputLength: AwsLambdaService.MAX_DECOMPRESSED_BYTES,
    });
    return JSON.parse(decompressed.toString("utf8"));
  }
}
