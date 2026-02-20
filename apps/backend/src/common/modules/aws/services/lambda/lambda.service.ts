import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import type { InvokeCommandInput } from "@aws-sdk/client-lambda";
import { Injectable } from "@nestjs/common";

import { ErrorCodes } from "../../../../utils/error-codes";
import type { Result } from "../../../../utils/fp-utils";
import { tryCatch, AppError } from "../../../../utils/fp-utils";
import { AwsConfigService } from "../config/config.service";
import type { InvokeLambdaRequest, InvokeLambdaResponse } from "./lambda.types";

@Injectable()
export class AwsLambdaService {
  private readonly lambdaClient: LambdaClient;

  constructor(private readonly configService: AwsConfigService) {
    this.lambdaClient = new LambdaClient({
      region: this.configService.region,
    });
  }

  /**
   * Invoke a Lambda function with a JSON payload
   */
  async invoke(request: InvokeLambdaRequest): Promise<Result<InvokeLambdaResponse>> {
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

        const responsePayload: Record<string, unknown> = response.Payload
          ? (JSON.parse(new TextDecoder().decode(response.Payload)) as Record<string, unknown>)
          : {};

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
}
