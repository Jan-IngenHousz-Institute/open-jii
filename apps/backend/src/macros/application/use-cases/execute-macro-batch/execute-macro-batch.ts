import { Inject, Injectable, Logger } from "@nestjs/common";

import type {
  MacroBatchExecutionRequestBody,
  MacroBatchExecutionResponse,
  MacroBatchExecutionResultItem,
} from "@repo/api/domains/macro/macro.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import type { Result } from "../../../../common/utils/fp-utils";
import { success, failure, AppError } from "../../../../common/utils/fp-utils";
import type { LambdaExecutionPayload } from "../../../core/models/macro-execution.model";
import { LambdaExecutionResponseSchema } from "../../../core/models/macro-execution.model";
import type { MacroScript } from "../../../core/models/macro.model";
import { LAMBDA_PORT, LambdaPort } from "../../../core/ports/lambda.port";
import {
  macroSnapshotKey,
  MacroSnapshotRepository,
} from "../../../core/repositories/macro-snapshot.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class ExecuteMacroBatchUseCase {
  private readonly logger = new Logger(ExecuteMacroBatchUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly macroSnapshotRepository: MacroSnapshotRepository,
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

    // 1. Resolve published snapshot scripts for workbook measurements. Legacy
    // callers without a workbook version continue to use the live macro row.
    const liveMacroIds = [
      ...new Set(
        request.items.filter((item) => !item.workbook_version_id).map((item) => item.macro_id),
      ),
    ];
    const workbookVersionIds = [
      ...new Set(
        request.items.flatMap((item) =>
          item.workbook_version_id ? [item.workbook_version_id] : [],
        ),
      ),
    ];

    const [macrosResult, snapshotsResult] = await Promise.all([
      this.macroRepository.findScriptsByIds(liveMacroIds),
      this.macroSnapshotRepository.findScriptsByVersionIds(workbookVersionIds),
    ]);
    if (macrosResult.isFailure() || snapshotsResult.isFailure()) {
      return failure(
        AppError.internal("Failed to fetch macro scripts", ErrorCodes.MACRO_EXECUTION_FAILED),
      );
    }

    const macroMap = macrosResult.value;
    const snapshotMap = snapshotsResult.value;

    // 2. Group by macro + version. The same macro UUID can legitimately have
    // different code in two published workbook versions in one Spark batch.
    const groups = new Map<
      string,
      {
        macroId: string;
        workbookVersionId?: string;
        items: typeof request.items;
      }
    >();
    for (const item of request.items) {
      const key = item.workbook_version_id
        ? macroSnapshotKey(item.workbook_version_id, item.macro_id)
        : `live:${item.macro_id}`;
      const group = groups.get(key) ?? {
        macroId: item.macro_id,
        workbookVersionId: item.workbook_version_id,
        items: [],
      };
      group.items.push(item);
      groups.set(key, group);
    }

    // 3. Fan out Lambda invocations in parallel (one per macro snapshot)
    const groupResults = await Promise.all(
      [...groups.values()].map(({ macroId, workbookVersionId, items }) => {
        const macro = workbookVersionId
          ? snapshotMap.get(macroSnapshotKey(workbookVersionId, macroId))
          : macroMap.get(macroId);
        return this.processGroup(macroId, items, macro, request.timeout ?? 30, workbookVersionId);
      }),
    );

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
      success: true as const,
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
    workbookVersionId?: string,
  ): Promise<{ results: MacroBatchExecutionResultItem[]; error?: string }> {
    if (!macro) {
      const notFound = workbookVersionId
        ? `Macro snapshot not found: ${macroId} in workbook version ${workbookVersionId}`
        : `Macro not found: ${macroId}`;
      return {
        results: items.map((item) => ({
          id: item.id,
          macro_id: macroId,
          success: false,
          error: notFound,
        })),
        error: notFound,
      };
    }

    const functionName = this.lambdaPort.getFunctionNameForLanguage(macro.language);

    const payload: LambdaExecutionPayload = {
      script: macro.code,
      items: items.map((item) => ({
        id: item.id,
        data: item.data,
        context: item.context,
      })),
      timeout,
    };

    const lambdaResult = await this.lambdaPort.invokeLambda(functionName, payload);

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

    const parseResult = LambdaExecutionResponseSchema.safeParse(lambdaResult.value.payload);
    if (!parseResult.success) {
      return {
        results: items.map((item) => ({
          id: item.id,
          macro_id: macroId,
          success: false,
          error: "Invalid Lambda response payload",
        })),
        error: `Macro ${macro.name} (${macroId}): Invalid Lambda response payload`,
      };
    }

    const lambdaResponse = parseResult.data;

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

    const resultMap = new Map(lambdaResponse.results.map((r) => [r.id, r]));

    return {
      results: items.map((item) => {
        const r = resultMap.get(item.id);
        if (!r) {
          return {
            id: item.id,
            macro_id: macroId,
            success: false,
            error: "No result returned from Lambda for this item",
          };
        }
        return {
          id: r.id,
          macro_id: macroId,
          success: r.success,
          output: r.output,
          error: r.error,
        };
      }),
    };
  }
}
