import { Inject, Injectable, Logger } from "@nestjs/common";

import type {
  MacroExecutionRequestBody,
  MacroExecutionResponse,
} from "@repo/api/domains/macro/macro.schema";
import { normalizeMacroInput } from "@repo/api/transforms/normalize-macro-input";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import type { Result } from "../../../../common/utils/fp-utils";
import { success, failure, AppError } from "../../../../common/utils/fp-utils";
import type { LambdaExecutionPayload } from "../../../core/models/macro-execution.model";
import {
  CANONICAL_MEASUREMENT_CONTRACT,
  emptyEnvelopeError,
  LambdaExecutionResponseSchema,
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

    // 2. Normalize the request data to the canonical measurement value before
    // building the Lambda item. An empty recognized envelope fails this item
    // without invoking Lambda; user code never runs on a missing measurement.
    const normalized = normalizeMacroInput(request.data);
    const itemId = "single";

    if (!normalized.ok) {
      this.logger.log({
        msg: "Empty measurement envelope; skipping Lambda invocation",
        operation: "executeMacro",
        macroId,
        source: normalized.source,
        sourceCount: normalized.sourceCount,
      });

      return success({
        macro_id: macroId,
        success: false,
        error: emptyEnvelopeError(normalized.source),
      });
    }

    if (normalized.warning) {
      this.logger.warn({
        msg: "Macro input projection discarded additional entries",
        operation: "executeMacro",
        macroId,
        warning: normalized.warning,
        source: normalized.source,
        sourceCount: normalized.sourceCount,
        discardedCount: normalized.discardedCount,
      });
    }

    // 3. Resolve the Lambda function and build the marked payload
    const functionName = this.lambdaPort.getFunctionNameForLanguage(macro.language);

    const payload: LambdaExecutionPayload = {
      input_contract: CANONICAL_MEASUREMENT_CONTRACT,
      script: macro.code,
      items: [{ id: itemId, data: normalized.value, context: request.context }],
      timeout: request.timeout ?? 30,
    };

    // 4. Invoke Lambda
    const lambdaResult = await this.lambdaPort.invokeLambda(functionName, payload);

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

    const parseResult = LambdaExecutionResponseSchema.safeParse(lambdaResult.value.payload);
    if (!parseResult.success) {
      this.logger.error({
        msg: "Invalid Lambda response payload",
        operation: "executeMacro",
        macroId,
        errors: parseResult.error.errors,
      });

      return success({
        macro_id: macroId,
        success: false,
        error: "Invalid Lambda response payload",
      });
    }

    const lambdaResponse = parseResult.data;

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

    // 5. Extract the single result by matching the request item ID
    const result = lambdaResponse.results.find((r) => r.id === itemId);

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
