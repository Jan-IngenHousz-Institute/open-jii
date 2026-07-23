import { Controller, Logger, UseGuards } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { macroContract } from "@repo/api/domains/macro/macro.contract";

import { HmacGuard } from "../../common/guards/hmac.guard";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { ExecuteMacroBatchUseCase } from "../application/use-cases/execute-macro-batch/execute-macro-batch";

@Controller()
@AllowAnonymous()
@UseGuards(HmacGuard)
export class MacroWebhookController {
  private readonly logger = new Logger(MacroWebhookController.name);

  constructor(private readonly executeMacroBatchUseCase: ExecuteMacroBatchUseCase) {}

  @Implement(macroContract.executeMacroBatch)
  handleExecuteMacroBatch() {
    return implement(macroContract.executeMacroBatch).handler(async ({ input }) => {
      const result = await this.executeMacroBatchUseCase.execute(input);

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Macro batch execution completed",
          operation: "executeMacroBatch",
          totalResults: result.value.results.length,
          successCount: result.value.results.filter((r) => r.success).length,
          failureCount: result.value.results.filter((r) => !r.success).length,
          status: "success",
        });
        return result.value;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }
}
