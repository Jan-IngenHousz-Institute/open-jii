import { Inject, Injectable, Logger } from "@nestjs/common";

import type {
  MacroBatchExecutionRequestBody,
  MacroBatchExecutionResponse,
  MacroBatchExecutionResultItem,
} from "@repo/api/domains/macro/macro.schema";
import { normalizeMacroInput } from "@repo/api/transforms/normalize-macro-input";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import type { Result } from "../../../../common/utils/fp-utils";
import { success, failure, AppError } from "../../../../common/utils/fp-utils";
import type { LambdaExecutionPayload } from "../../../core/models/macro-execution.model";
import {
  emptyEnvelopeError,
  LambdaExecutionResponseSchema,
} from "../../../core/models/macro-execution.model";
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
    // Each group carries its items' original request positions so results can
    // be reassembled into exact global order after concurrent fan-out.
    const groups = new Map<
      string,
      {
        macroId: string;
        workbookVersionId?: string;
        items: typeof request.items;
        indexes: number[];
      }
    >();
    request.items.forEach((item, index) => {
      const key = item.workbook_version_id
        ? macroSnapshotKey(item.workbook_version_id, item.macro_id)
        : `live:${item.macro_id}`;
      const group = groups.get(key) ?? {
        macroId: item.macro_id,
        workbookVersionId: item.workbook_version_id,
        items: [],
        indexes: [],
      };
      group.items.push(item);
      group.indexes.push(index);
      groups.set(key, group);
    });

    // 3. Fan out Lambda invocations in parallel (one per macro snapshot)
    const groupResults = await Promise.all(
      [...groups.values()].map(async ({ macroId, workbookVersionId, items, indexes }) => {
        const macro = workbookVersionId
          ? snapshotMap.get(macroSnapshotKey(workbookVersionId, macroId))
          : macroMap.get(macroId);
        const { results, error } = await this.processGroup(
          macroId,
          items,
          macro,
          request.timeout ?? 30,
          workbookVersionId,
        );
        return { results, error, indexes };
      }),
    );

    // 4. Reassemble every group's results into exact global request order.
    // Group processing preserves within-group order, so each result maps back
    // to its item's captured original position regardless of grouping or
    // concurrent completion order.
    const allResults = new Array<MacroBatchExecutionResultItem>(request.items.length);
    const errors: string[] = [];

    for (const group of groupResults) {
      group.results.forEach((result, i) => {
        allResults[group.indexes[i]] = result;
      });
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
   * Never throws; returns partial failure results for the group on error.
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

    // Normalize every item exactly once. Empty recognized envelopes fail
    // locally and never reach Lambda; only valid siblings are invoked.
    const normalizedItems = items.map((item) => {
      const normalized = normalizeMacroInput(item.data);
      if (normalized.ok && normalized.warning) {
        this.logger.warn({
          msg: "Macro input projection discarded additional entries",
          operation: "executeMacroBatch",
          macroId,
          itemId: item.id,
          warning: normalized.warning,
          source: normalized.source,
          sourceCount: normalized.sourceCount,
          discardedCount: normalized.discardedCount,
        });
      }
      return { item, normalized };
    });

    const validItems: { item: (typeof items)[number]; data: unknown }[] = [];
    for (const { item, normalized } of normalizedItems) {
      if (normalized.ok) validItems.push({ item, data: normalized.value });
    }

    // Merge local failures and Lambda results back into original request
    // order. Result IDs come from the original item at each position because
    // request item IDs may be duplicated or empty, so positional (not ID)
    // matching is the only safe merge.
    const assemble = (
      validResults: MacroBatchExecutionResultItem[],
    ): MacroBatchExecutionResultItem[] => {
      let validIndex = 0;
      return normalizedItems.map(({ item, normalized }) =>
        normalized.ok
          ? validResults[validIndex++]
          : {
              id: item.id,
              macro_id: macroId,
              success: false,
              error: emptyEnvelopeError(normalized.source),
            },
      );
    };

    // Every item was an empty envelope; do not invoke Lambda at all, and do
    // not resolve a function name (a locally resolvable empty group must never
    // fail on Lambda configuration).
    if (validItems.length === 0) {
      return { results: assemble([]) };
    }

    const functionName = this.lambdaPort.getFunctionNameForLanguage(macro.language);

    const payload: LambdaExecutionPayload = {
      script: macro.code,
      items: validItems.map(({ item, data }) => ({
        id: item.id,
        data,
        context: item.context,
      })),
      timeout,
    };

    const lambdaResult = await this.lambdaPort.invokeLambda(functionName, payload);

    if (lambdaResult.isFailure()) {
      const errorMsg = lambdaResult.error.message;
      return {
        results: assemble(
          validItems.map(({ item }) => ({
            id: item.id,
            macro_id: macroId,
            success: false,
            error: errorMsg,
          })),
        ),
        error: `Macro ${macro.name} (${macroId}): ${errorMsg}`,
      };
    }

    const parseResult = LambdaExecutionResponseSchema.safeParse(lambdaResult.value.payload);
    if (!parseResult.success) {
      return {
        results: assemble(
          validItems.map(({ item }) => ({
            id: item.id,
            macro_id: macroId,
            success: false,
            error: "Invalid Lambda response payload",
          })),
        ),
        error: `Macro ${macro.name} (${macroId}): Invalid Lambda response payload`,
      };
    }

    const lambdaResponse = parseResult.data;

    if (lambdaResponse.status === "error") {
      const errorMsg = lambdaResponse.errors?.join("; ") ?? "Lambda execution failed";
      return {
        results: assemble(
          validItems.map(({ item }) => ({
            id: item.id,
            macro_id: macroId,
            success: false,
            error: errorMsg,
          })),
        ),
        error: `Macro ${macro.name} (${macroId}): ${errorMsg}`,
      };
    }

    // The sandbox returns one result per valid item, in order, echoing each
    // request ID. A count or per-position ID mismatch fails the whole group
    // safely (position stays authoritative; ID equality is only a check,
    // compatible with duplicate/empty IDs). Length is checked first.
    const lambdaResults = lambdaResponse.results;
    const mismatch =
      lambdaResults.length !== validItems.length ||
      validItems.some(({ item }, index) => lambdaResults[index].id !== item.id);

    if (mismatch) {
      const errorMsg = "Lambda response did not match the requested items";
      return {
        results: assemble(
          validItems.map(({ item }) => ({
            id: item.id,
            macro_id: macroId,
            success: false,
            error: errorMsg,
          })),
        ),
        error: `Macro ${macro.name} (${macroId}): ${errorMsg}`,
      };
    }

    // Counts and per-position IDs are validated; consume positionally.
    const validResults = validItems.map(({ item }, index): MacroBatchExecutionResultItem => {
      const r = lambdaResults[index];
      return {
        id: item.id,
        macro_id: macroId,
        success: r.success,
        output: r.output,
        error: r.error,
      };
    });

    return { results: assemble(validResults) };
  }
}
