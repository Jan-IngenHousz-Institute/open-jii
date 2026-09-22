import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentJoinCodesContract } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.contract";

import { CanAccess } from "../../authorization/can-access.decorator";
import { formatDates } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { CreateJoinCodeUseCase } from "../application/use-cases/experiment-join-codes/create-join-code";
import { GetJoinCodeUseCase } from "../application/use-cases/experiment-join-codes/get-join-code";
import { RevokeJoinCodeUseCase } from "../application/use-cases/experiment-join-codes/revoke-join-code";

/**
 * The organizer's side of a join code. Gated on `share`, the capability that owns
 * handing out access; the two joiner routes live in their own controller because
 * they are throttled and identify the experiment by code rather than by id.
 */
@Controller()
export class ExperimentJoinCodesController {
  private readonly logger = new Logger(ExperimentJoinCodesController.name);

  constructor(
    private readonly getJoinCodeUseCase: GetJoinCodeUseCase,
    private readonly createJoinCodeUseCase: CreateJoinCodeUseCase,
    private readonly revokeJoinCodeUseCase: RevokeJoinCodeUseCase,
  ) {}

  @CanAccess({ resource: "experiment", action: "share" })
  @Implement(experimentJoinCodesContract.getJoinCode)
  getJoinCode() {
    return implement(experimentJoinCodesContract.getJoinCode).handler(async ({ input }) => {
      const result = await this.getJoinCodeUseCase.execute(input.id);

      if (result.isSuccess()) {
        return { joinCode: result.value ? formatDates(result.value) : null };
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "share" })
  @Implement(experimentJoinCodesContract.createJoinCode)
  createJoinCode(@Session() session: UserSession) {
    return implement(experimentJoinCodesContract.createJoinCode).handler(async ({ input }) => {
      const result = await this.createJoinCodeUseCase.execute(
        input.id,
        session.user.id,
        input.expiresIn,
      );

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "share" })
  @Implement(experimentJoinCodesContract.revokeJoinCode)
  revokeJoinCode() {
    return implement(experimentJoinCodesContract.revokeJoinCode).handler(async ({ input }) => {
      const result = await this.revokeJoinCodeUseCase.execute(input.id);

      if (result.isSuccess()) {
        return undefined;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }
}
