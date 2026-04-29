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
    const { functionName, payload, invocationType = "RequestResponse" } = request;

    return tryCatch(
      async () => {
        const input: InvokeCommandInput = {
          FunctionName: functionName,
          InvocationType: invocationType,
          Payload: new TextEncoder().encode(JSON.stringify(payload)),
        };

        const command = new InvokeCommand(input);
        const response = await this.lambdaClient.send(command);

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
      (error) => {
        if (error instanceof AppError) {
          return error;
        }
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return AppError.internal(errorMessage, ErrorCodes.AWS_OPERATION_FAILED);
      },
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
