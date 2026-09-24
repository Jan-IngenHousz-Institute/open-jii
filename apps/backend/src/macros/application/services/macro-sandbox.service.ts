import { Inject, Injectable, Logger } from "@nestjs/common";

import type {
  MacroBatchExecutionRequestBody,
  MacroBatchExecutionResultItem,
} from "@repo/api/domains/macro/macro.schema";
import { restoreMacroInputInContext } from "@repo/api/transforms/macro-context-ref";
import { normalizeMacroInput } from "@repo/api/transforms/normalize-macro-input";

import type {
  LambdaExecutionPayload,
  MacroRunOutcome,
} from "../../core/models/macro-execution.model";
import {
  emptyEnvelopeError,
  LambdaExecutionResponseSchema,
} from "../../core/models/macro-execution.model";
import type { MacroScript } from "../../core/models/macro.model";
import { LAMBDA_PORT, LambdaPort } from "../../core/ports/lambda.port";

type MacroItems = MacroBatchExecutionRequestBody["items"];

interface NormalizedItem {
  item: MacroItems[number];
  normalized: ReturnType<typeof normalizeMacroInput>;
}

/**
 * Runs one macro script over its items in the sandbox Lambda. Never throws: an
 * empty measurement envelope fails only its own item, and a failed invocation
 * fails only the items it carried. Results come back in item order.
 */
@Injectable()
export class MacroSandboxService {
  private readonly logger = new Logger(MacroSandboxService.name);

  // Lambda refuses a synchronous request over 6 MB. Restoring each item's
  // context can copy its measurement a second time, so the limit is checked on
  // the payload as sent, not on the request this service received.
  private static readonly MAX_INVOCATION_BYTES = 6 * 1024 * 1024;

  constructor(@Inject(LAMBDA_PORT) private readonly lambdaPort: LambdaPort) {}

  async run(
    macro: MacroScript,
    macroId: string,
    items: MacroItems,
    timeout: number,
  ): Promise<MacroRunOutcome> {
    const normalizedItems = this.normalize(macroId, items);
    const validItems = normalizedItems.flatMap(({ item, normalized }) =>
      normalized.ok ? [{ item, data: normalized.value }] : [],
    );

    // Every item was an empty envelope; do not invoke Lambda at all, and do
    // not resolve a function name (a locally resolvable empty group must never
    // fail on Lambda configuration).
    if (validItems.length === 0) {
      return { results: this.assemble(macroId, normalizedItems, []) };
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
    const errors = outcomes.flatMap((outcome) => (outcome.error ? [outcome.error] : []));

    return {
      results: this.assemble(
        macroId,
        normalizedItems,
        outcomes.flatMap((outcome) => outcome.results),
      ),
      ...(errors.length > 0 ? { error: errors.join("; ") } : {}),
    };
  }

  /**
   * Normalizes every item exactly once. Empty recognized envelopes fail
   * locally and never reach Lambda; only valid siblings are invoked.
   */
  private normalize(macroId: string, items: MacroItems): NormalizedItem[] {
    return items.map((item) => {
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
  }

  /**
   * Merges local failures and Lambda results back into item order. Result IDs
   * come from the original item at each position because request item IDs may
   * be duplicated or empty, so positional (not ID) matching is the only safe merge.
   */
  private assemble(
    macroId: string,
    normalizedItems: NormalizedItem[],
    validResults: MacroBatchExecutionResultItem[],
  ): MacroBatchExecutionResultItem[] {
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
        chunk.length > 0 && chunkBytes + itemBytes > MacroSandboxService.MAX_INVOCATION_BYTES;

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
  ): Promise<MacroRunOutcome> {
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
