import { Controller, Logger, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentJoinCodesContract } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.contract";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { RedeemJoinCodeUseCase } from "../application/use-cases/experiment-join-codes/redeem-join-code";
import { ResolveJoinCodeUseCase } from "../application/use-cases/experiment-join-codes/resolve-join-code";
import { JoinCodeThrottlerGuard } from "./join-code-throttler.guard";

/**
 * The joiner's two routes, and the only surface from which the code space can be
 * probed — hence the per-user limit. The organizer routes are in the other
 * controller and unthrottled. The throttle key includes the handler, so resolving
 * and redeeming get a bucket each.
 */
@Controller()
@UseGuards(JoinCodeThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class ExperimentJoinCodeRedemptionController {
  private readonly logger = new Logger(ExperimentJoinCodeRedemptionController.name);

  constructor(
    private readonly resolveJoinCodeUseCase: ResolveJoinCodeUseCase,
    private readonly redeemJoinCodeUseCase: RedeemJoinCodeUseCase,
  ) {}

  @Implement(experimentJoinCodesContract.resolveJoinCode)
  resolveJoinCode(@Session() session: UserSession) {
    return implement(experimentJoinCodesContract.resolveJoinCode).handler(async ({ input }) => {
      const result = await this.resolveJoinCodeUseCase.execute(input.code, session.user.id);

      if (result.isSuccess()) {
        return {
          ...result.value,
          expiresAt: result.value.expiresAt ? result.value.expiresAt.toISOString() : null,
        };
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentJoinCodesContract.redeemJoinCode)
  redeemJoinCode(@Session() session: UserSession) {
    return implement(experimentJoinCodesContract.redeemJoinCode).handler(async ({ input }) => {
      const result = await this.redeemJoinCodeUseCase.execute(input.code, session.user.id);

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }
}
