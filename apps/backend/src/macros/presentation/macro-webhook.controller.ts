import { Controller, Logger, UseGuards } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { macroContract, zMacroBatchExecutionRequestBody } from "@repo/api";

import { HmacGuard } from "../../common/guards/hmac.guard";
import { handleFailure } from "../../common/utils/fp-utils";
import { ExecuteMacroBatchUseCase } from "../application/use-cases/execute-macro-batch/execute-macro-batch";

@Controller()
@AllowAnonymous()
@UseGuards(HmacGuard)
export class MacroWebhookController {
  private readonly logger = new Logger(MacroWebhookController.name);

  constructor(private readonly executeMacroBatchUseCase: ExecuteMacroBatchUseCase) {}

  @TsRestHandler(macroContract.executeMacroBatch)
  handleExecuteMacroBatch() {
    return tsRestHandler(macroContract.executeMacroBatch, async ({ body }) => {
      const parsed = zMacroBatchExecutionRequestBody.safeParse(body);

      if (!parsed.success) {
        this.logger.warn({
          msg: "Invalid macro batch execution request",
          operation: "executeMacroBatch",
          errors: parsed.error.format(),
        });

        return {
          status: StatusCodes.BAD_REQUEST as const,
          body: {
            error: "VALIDATION_ERROR",
            message: "Invalid request body",
            statusCode: StatusCodes.BAD_REQUEST,
          },
        };
      }

      const result = await this.executeMacroBatchUseCase.execute(parsed.data);

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Macro batch execution completed",
          operation: "executeMacroBatch",
          totalResults: result.value.results.length,
          successCount: result.value.results.filter((r) => r.success).length,
          failureCount: result.value.results.filter((r) => !r.success).length,
          status: "success",
        });

        return {
          status: StatusCodes.OK as const,
          body: result.value,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
