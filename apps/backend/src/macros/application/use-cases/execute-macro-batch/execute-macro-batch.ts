import { Inject, Injectable, Logger } from "@nestjs/common";

import type {
  MacroBatchExecutionRequestBody,
  MacroBatchExecutionResponse,
  MacroBatchExecutionResultItem,
} from "@repo/api";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import type { Result } from "../../../../common/utils/fp-utils";
import { success, failure, AppError } from "../../../../common/utils/fp-utils";
import type {
  LambdaExecutionPayload,
  LambdaExecutionResponse,
} from "../../../core/models/macro-execution.model";
import type { MacroScript } from "../../../core/models/macro.model";
import { LAMBDA_PORT, LambdaPort } from "../../../core/ports/lambda.port";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class ExecuteMacroBatchUseCase {
  private readonly logger = new Logger(ExecuteMacroBatchUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    @Inject(LAMBDA_PORT) private readonly lambdaPort: LambdaPort,
  ) {}

  async execute(
    request: MacroBatchExecutionRequestBody,
  ): Promise<Result<MacroBatchExecutionResponse>> {
    this.logger.log({
      msg: "Starting macro batch execution",
      operation: "executeMacroBatch",
      itemCount: request.items.length,
      timeout: request.timeout,
    });

    // 1. Collect unique macro IDs and fetch scripts (cached in repository)
    const uniqueMacroIds = [...new Set(request.items.map((item) => item.macro_id))];

    const macrosResult = await this.macroRepository.findScriptsByIds(uniqueMacroIds);
    if (macrosResult.isFailure()) {
      return failure(
        AppError.internal("Failed to fetch macro scripts", ErrorCodes.MACRO_EXECUTION_FAILED),
      );
    }

    const macroMap = macrosResult.value;

    // 2. Group items by macro_id
    const groups = new Map<string, typeof request.items>();
    for (const item of request.items) {
      const group = groups.get(item.macro_id) ?? [];
      group.push(item);
      groups.set(item.macro_id, group);
    }

    // 3. Fan out Lambda invocations in parallel (one per macro_id)
    const lambdaPromises = [...groups.entries()].map(([macroId, items]) =>
      this.processGroup(macroId, items, macroMap.get(macroId), request.timeout ?? 30),
    );

    const groupResults = await Promise.all(lambdaPromises);

    // 4. Merge results
    const allResults: MacroBatchExecutionResultItem[] = [];
    const errors: string[] = [];

    for (const group of groupResults) {
      allResults.push(...group.results);
      if (group.error) {
        errors.push(group.error);
      }
    }

    this.logger.log({
      msg: "Macro batch execution completed",
      operation: "executeMacroBatch",
      totalItems: request.items.length,
      successCount: allResults.filter((r) => r.success).length,
      failureCount: allResults.filter((r) => !r.success).length,
    });

    return success({
      results: allResults,
      ...(errors.length > 0 ? { errors } : {}),
    });
  }

  /**
   * Process a single macro group: invoke the appropriate Lambda and map results.
   * Never throws — returns partial failure results for the group on error.
   */
  private async processGroup(
    macroId: string,
    items: MacroBatchExecutionRequestBody["items"],
    macro: MacroScript | undefined,
    timeout: number,
  ): Promise<{ results: MacroBatchExecutionResultItem[]; error?: string }> {
    if (!macro) {
      return {
        results: items.map((item) => ({
          id: item.id,
          macro_id: macroId,
          success: false,
          error: `Macro not found: ${macroId}`,
        })),
        error: `Macro not found: ${macroId}`,
      };
    }

    const functionName = this.lambdaPort.getFunctionNameForLanguage(macro.language);

    const payload: LambdaExecutionPayload = {
      script: macro.code,
      items: items.map((item) => ({ id: item.id, data: item.data })),
      timeout,
    };

    const lambdaResult = await this.lambdaPort.invokeLambda(
      functionName,
      payload as unknown as Record<string, unknown>,
    );

    if (lambdaResult.isFailure()) {
      const errorMsg = lambdaResult.error.message;
      return {
        results: items.map((item) => ({
          id: item.id,
          macro_id: macroId,
          success: false,
          error: errorMsg,
        })),
        error: `Macro ${macro.name} (${macroId}): ${errorMsg}`,
      };
    }

    const lambdaResponse = lambdaResult.value.payload as unknown as LambdaExecutionResponse;

    if (lambdaResponse.status === "error") {
      const errorMsg = lambdaResponse.errors?.join("; ") ?? "Lambda execution failed";
      return {
        results: items.map((item) => ({
          id: item.id,
          macro_id: macroId,
          success: false,
          error: errorMsg,
        })),
        error: `Macro ${macro.name} (${macroId}): ${errorMsg}`,
      };
    }

    return {
      results: lambdaResponse.results.map((r) => ({
        id: r.id,
        macro_id: macroId,
        success: r.success,
        output: r.output,
        error: r.error,
      })),
    };
  }
}
