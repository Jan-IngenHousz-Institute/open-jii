import { Inject, Injectable, Logger } from "@nestjs/common";

import type {
  MacroBatchExecutionRequestBody,
  MacroBatchExecutionResponse,
  MacroBatchExecutionResultItem,
} from "@repo/api/domains/macro/macro.schema";
import { restoreMacroInputInContext } from "@repo/api/transforms/macro-context-ref";
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

  // Lambda refuses a synchronous request over 6 MB. Restoring each item's
  // context can copy its measurement a second time, so the limit is checked on
  // the payload as sent, not on the request this service received.
  private static readonly MAX_INVOCATION_BYTES = 6 * 1024 * 1024;

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

    const payloadItems = validItems.map(({ item, data }) => ({
      id: item.id,
      data,
      // A mobile upload leaves a marker where ctx held this same measurement;
      // macro code must still see the value it saw at capture time.
      context: item.context ? restoreMacroInputInContext(item.context, item.data) : item.context,
    }));

    // Together, so a split group still finishes within one Lambda timeout, which
    // is all the caller's request allows. The Lambda client retries a throttled one.
    const outcomes = await Promise.all(
      this.chunkByInvocationBytes(macro.code, timeout, payloadItems).map((chunk) =>
        this.invokeChunk(functionName, macro, macroId, chunk, timeout),
      ),
    );
    const validResults: MacroBatchExecutionResultItem[] = outcomes.flatMap(
      (outcome) => outcome.results,
    );
    const errors = outcomes.flatMap((outcome) => (outcome.error ? [outcome.error] : []));

    return {
      results: assemble(validResults),
      ...(errors.length > 0 ? { error: errors.join("; ") } : {}),
    };
  }

  /**
   * Splits a group's items into invocations under Lambda's request limit,
   * measured the way the Lambda service encodes the payload. An item over the
   * limit on its own still goes alone, so Lambda refuses that item and not its
   * siblings.
   */
  private chunkByInvocationBytes(
    script: string,
    timeout: number,
    items: LambdaExecutionPayload["items"],
  ): LambdaExecutionPayload["items"][] {
    const envelopeBytes = Buffer.byteLength(JSON.stringify({ script, items: [], timeout }));
    const chunks: LambdaExecutionPayload["items"][] = [];
    let chunk: LambdaExecutionPayload["items"] = [];
    let chunkBytes = envelopeBytes;

    for (const item of items) {
      // The comma joining this item to the one before it is part of the body.
      const itemBytes = Buffer.byteLength(JSON.stringify(item)) + 1;
      const isFull =
        chunk.length > 0 && chunkBytes + itemBytes > ExecuteMacroBatchUseCase.MAX_INVOCATION_BYTES;

      if (isFull) {
        chunks.push(chunk);
        chunk = [];
        chunkBytes = envelopeBytes;
      }

      chunk.push(item);
      chunkBytes += itemBytes;
    }

    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    return chunks;
  }

  /**
   * Invokes the sandbox for one chunk and maps its results. Never throws; a
   * failed invocation fails only the items it carried.
   */
  private async invokeChunk(
    functionName: string,
    macro: MacroScript,
    macroId: string,
    items: LambdaExecutionPayload["items"],
    timeout: number,
  ): Promise<{ results: MacroBatchExecutionResultItem[]; error?: string }> {
    const failAll = (errorMsg: string) => ({
      results: items.map(({ id }) => ({
        id,
        macro_id: macroId,
        success: false,
        error: errorMsg,
      })),
      error: `Macro ${macro.name} (${macroId}): ${errorMsg}`,
    });

    const payload: LambdaExecutionPayload = { script: macro.code, items, timeout };
    const lambdaResult = await this.lambdaPort.invokeLambda(functionName, payload);

    if (lambdaResult.isFailure()) {
      return failAll(lambdaResult.error.message);
    }

    const parseResult = LambdaExecutionResponseSchema.safeParse(lambdaResult.value.payload);
    if (!parseResult.success) {
      return failAll("Invalid Lambda response payload");
    }

    const lambdaResponse = parseResult.data;

    if (lambdaResponse.status === "error") {
      return failAll(lambdaResponse.errors?.join("; ") ?? "Lambda execution failed");
    }

    // The sandbox returns one result per item, in order, echoing each request
    // ID. A count or per-position ID mismatch fails the whole chunk safely
    // (position stays authoritative; ID equality is only a check, compatible
    // with duplicate/empty IDs). Length is checked first.
    const lambdaResults = lambdaResponse.results;
    const mismatch =
      lambdaResults.length !== items.length ||
      items.some(({ id }, index) => lambdaResults[index].id !== id);

    if (mismatch) {
      return failAll("Lambda response did not match the requested items");
    }

    // Counts and per-position IDs are validated; consume positionally.
    return {
      results: items.map(({ id }, index): MacroBatchExecutionResultItem => {
        const r = lambdaResults[index];
        return {
          id,
          macro_id: macroId,
          success: r.success,
          output: r.output,
          error: r.error,
        };
      }),
    };
  }
}
