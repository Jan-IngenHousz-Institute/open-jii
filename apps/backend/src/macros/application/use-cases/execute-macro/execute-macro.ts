import { Inject, Injectable, Logger } from "@nestjs/common";

import type {
  MacroExecutionRequestBody,
  MacroExecutionResponse,
} from "@repo/api/domains/macro/macro.schema";
import { restoreMacroInputInContext } from "@repo/api/transforms/macro-context-ref";
import { normalizeMacroInput } from "@repo/api/transforms/normalize-macro-input";

import { AuthorizationService } from "../../../../authorization/authorization.service";
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
export class ExecuteMacroUseCase {
  private readonly logger = new Logger(ExecuteMacroUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly macroSnapshotRepository: MacroSnapshotRepository,
    @Inject(LAMBDA_PORT) private readonly lambdaPort: LambdaPort,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(
    macroId: string,
    request: MacroExecutionRequestBody,
    userId?: string,
  ): Promise<Result<MacroExecutionResponse>> {
    this.logger.log({
      msg: "Starting single macro execution",
      operation: "executeMacro",
      macroId,
      timeout: request.timeout,
    });

    // 1. Fetch the live macro script, or the pinned version's snapshot (both cached)
    const macroResult = request.workbookVersionId
      ? await this.findPinnedScript(macroId, request.workbookVersionId, userId)
      : await this.macroRepository.findScriptById(macroId);
    if (macroResult.isFailure()) {
      if (request.workbookVersionId) return macroResult;
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

    // 3. Resolve the Lambda function and build the payload
    const functionName = this.lambdaPort.getFunctionNameForLanguage(macro.language);

    const payload: LambdaExecutionPayload = {
      script: macro.code,
      items: [
        {
          id: itemId,
          data: normalized.value,
          // A mobile upload leaves a marker where ctx held this same
          // measurement; macro code must still see the capture-time value.
          context: request.context
            ? restoreMacroInputInContext(request.context, request.data)
            : request.context,
        },
      ],
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
        errors: parseResult.error.issues,
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

  // The caller already read the live macro through the route guard; a pinned run
  // also needs read on the workbook, and runs only a macro that version pinned.
  private async findPinnedScript(
    macroId: string,
    versionId: string,
    userId?: string,
  ): Promise<Result<MacroScript | null>> {
    const fetchFailed = () =>
      failure(AppError.internal("Failed to fetch macro script", ErrorCodes.MACRO_EXECUTION_FAILED));
    const workbookResult = await this.macroSnapshotRepository.findWorkbookIdByVersionId(versionId);
    if (workbookResult.isFailure()) return fetchFailed();
    const workbookId = workbookResult.value;
    if (!workbookId || !userId) {
      return failure(AppError.notFound(`Workbook version with ID ${versionId} not found`));
    }

    const access = await this.authz.can(userId, {
      resourceType: "workbook",
      resourceId: workbookId,
      action: "read",
    });
    if (!access.allow) {
      return failure(
        access.reason === "not-found"
          ? AppError.notFound(`Workbook version with ID ${versionId} not found`)
          : AppError.forbidden("You do not have access to this workbook"),
      );
    }

    const scriptsResult = await this.macroSnapshotRepository.findScriptsByVersionIds([versionId]);
    if (scriptsResult.isFailure()) return fetchFailed();
    return success(scriptsResult.value.get(macroSnapshotKey(versionId, macroId)) ?? null);
  }
}
