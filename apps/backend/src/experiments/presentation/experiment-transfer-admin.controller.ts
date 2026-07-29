import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentTransferAdminContract } from "@repo/api/domains/experiment/transfer-admin/experiment-transfer-admin.contract";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { TransferExperimentAdminUseCase } from "../application/use-cases/transfer-experiment-admin/transfer-experiment-admin";

/**
 * Admin hand-off, used to clear account-deletion blockers. Authorization is
 * per-transfer inside the use case (the caller must already administer each
 * experiment named), so there is no route-level `@CanAccess`: one request covers
 * several experiments.
 */
@Controller()
export class ExperimentTransferAdminController {
  private readonly logger = new Logger(ExperimentTransferAdminController.name);

  constructor(private readonly transferExperimentAdminUseCase: TransferExperimentAdminUseCase) {}

  @Implement(experimentTransferAdminContract.transferExperimentAdmin)
  transferAdmin(@Session() session: UserSession) {
    return implement(experimentTransferAdminContract.transferExperimentAdmin).handler(
      async ({ input }) => {
        const result = await this.transferExperimentAdminUseCase.execute(
          input.transfers,
          session.user.id,
        );
        if (result.isSuccess()) {
          return { results: result.value };
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }
}
