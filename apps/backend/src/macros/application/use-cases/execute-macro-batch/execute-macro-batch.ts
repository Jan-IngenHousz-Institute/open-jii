import { Injectable, Logger } from "@nestjs/common";

import type {
  MacroBatchExecutionRequestBody,
  MacroBatchExecutionResponse,
  MacroBatchExecutionResultItem,
} from "@repo/api/domains/macro/macro.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import type { Result } from "../../../../common/utils/fp-utils";
import { success, failure, AppError } from "../../../../common/utils/fp-utils";
import type { MacroRunOutcome } from "../../../core/models/macro-execution.model";
import {
  macroSnapshotKey,
  MacroSnapshotRepository,
} from "../../../core/repositories/macro-snapshot.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { MacroSandboxService } from "../../services/macro-sandbox.service";

interface ScriptGroup {
  macroId: string;
  workbookVersionId?: string;
  items: MacroBatchExecutionRequestBody["items"];
  indexes: number[];
}

@Injectable()
export class ExecuteMacroBatchUseCase {
  private readonly logger = new Logger(ExecuteMacroBatchUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly macroSnapshotRepository: MacroSnapshotRepository,
    private readonly macroSandbox: MacroSandboxService,
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

    // 2. Run every script group in parallel, one sandbox run per macro snapshot.
    const groupResults = await Promise.all(
      this.groupByScript(request.items).map(async (group) => {
        const macro = group.workbookVersionId
          ? snapshotMap.get(macroSnapshotKey(group.workbookVersionId, group.macroId))
          : macroMap.get(group.macroId);
        const outcome = macro
          ? await this.macroSandbox.run(macro, group.macroId, group.items, request.timeout ?? 30)
          : this.scriptNotFound(group);
        return { ...outcome, indexes: group.indexes };
      }),
    );

    // 3. Reassemble every group's results into exact global request order.
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
   * Groups items by macro and workbook version: the same macro UUID can have
   * different code in two published workbook versions in one Spark batch. Each
   * group keeps its items' request positions for reassembly.
   */
  private groupByScript(items: MacroBatchExecutionRequestBody["items"]): ScriptGroup[] {
    const groups = new Map<string, ScriptGroup>();
    items.forEach((item, index) => {
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
    return [...groups.values()];
  }

  /** Fails every item of a group whose script could not be found. */
  private scriptNotFound({ macroId, workbookVersionId, items }: ScriptGroup): MacroRunOutcome {
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
}
