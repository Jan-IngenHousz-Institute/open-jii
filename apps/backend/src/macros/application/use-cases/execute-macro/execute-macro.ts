import { Inject, Injectable, Logger } from "@nestjs/common";

import type { MacroExecutionRequestBody, MacroExecutionResponse } from "@repo/api";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import type { Result } from "../../../../common/utils/fp-utils";
import { success, failure, AppError } from "../../../../common/utils/fp-utils";
import type {
  LambdaExecutionPayload,
  LambdaExecutionResponse,
  LambdaExecutionResultItem,
} from "../../../core/models/macro-execution.model";
import { LAMBDA_PORT, LambdaPort } from "../../../core/ports/lambda.port";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class ExecuteMacroUseCase {
  private readonly logger = new Logger(ExecuteMacroUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    @Inject(LAMBDA_PORT) private readonly lambdaPort: LambdaPort,
  ) {}

  async execute(
    macroId: string,
    request: MacroExecutionRequestBody,
  ): Promise<Result<MacroExecutionResponse>> {
    this.logger.log({
      msg: "Starting single macro execution",
      operation: "executeMacro",
      macroId,
      timeout: request.timeout,
    });

    // 1. Fetch the macro script (cached in repository)
    const macroResult = await this.macroRepository.findScriptById(macroId);
    if (macroResult.isFailure()) {
      return failure(
        AppError.internal("Failed to fetch macro script", ErrorCodes.MACRO_EXECUTION_FAILED),
      );
    }

    const macro = macroResult.value;
    if (!macro) {
      return failure(AppError.notFound(`Macro not found: ${macroId}`, ErrorCodes.MACRO_NOT_FOUND));
    }

    // 2. Resolve the Lambda function and build the payload
    const functionName = this.lambdaPort.getFunctionNameForLanguage(macro.language);
    const itemId = "single";

    const payload: LambdaExecutionPayload = {
      script: macro.code,
      items: [{ id: itemId, data: request.data }],
      timeout: request.timeout ?? 30,
    };

    // 3. Invoke Lambda
    const lambdaResult = await this.lambdaPort.invokeLambda(
      functionName,
      payload as unknown as Record<string, unknown>,
    );

    if (lambdaResult.isFailure()) {
      this.logger.error({
        msg: "Lambda invocation failed",
        operation: "executeMacro",
        macroId,
        error: lambdaResult.error.message,
      });

      return success({
        macro_id: macroId,
        success: false,
        error: lambdaResult.error.message,
      });
    }

    const lambdaResponse = lambdaResult.value.payload as unknown as LambdaExecutionResponse;

    if (lambdaResponse.status === "error") {
      const errorMsg = lambdaResponse.errors?.join("; ") ?? "Lambda execution failed";

      this.logger.error({
        msg: "Lambda execution returned error status",
        operation: "executeMacro",
        macroId,
        error: errorMsg,
      });

      return success({
        macro_id: macroId,
        success: false,
        error: errorMsg,
      });
    }

    // 4. Extract the single result
    const result = lambdaResponse.results[0] as LambdaExecutionResultItem | undefined;

    if (!result) {
      return success({
        macro_id: macroId,
        success: false,
        error: "No result returned from Lambda",
      });
    }

    this.logger.log({
      msg: "Macro execution completed",
      operation: "executeMacro",
      macroId,
      success: result.success,
    });

    return success({
      macro_id: macroId,
      success: result.success,
      output: result.output,
      error: result.error,
    });
  }
}
