import { Injectable, Logger } from "@nestjs/common";

import type { RedeemJoinCodeResponse } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { isLivingUser, lockUserAccount } from "../../../../sharing/core/resource-staffing";
import { insertJoinGrant } from "../../../core/join-grant";
import { ExperimentJoinCodeRepository } from "../../../core/repositories/experiment-join-code.repository";
import { ExperimentJoinRequestRepository } from "../../../core/repositories/experiment-join-request.repository";
import { joinCodeNotFound, joinCodeRefusal } from "./join-code-validity";

const ACCOUNT_UNAVAILABLE_MESSAGE = "This account is not available to join experiments";

@Injectable()
export class RedeemJoinCodeUseCase {
  private readonly logger = new Logger(RedeemJoinCodeUseCase.name);

  constructor(
    private readonly joinCodeRepository: ExperimentJoinCodeRepository,
    private readonly joinRequestRepository: ExperimentJoinRequestRepository,
    private readonly authz: AuthorizationService,
  ) {}

  /**
   * Everything runs on one transaction handle. The backend pool holds a single
   * connection, so any query awaited against the root handle from inside the
   * transaction would wait on the connection the transaction itself is holding.
   *
   * Lock order is the redeemer's user row, experiment row, code row, join request,
   * grant. The user row comes first, as every grant write takes it: account deletion
   * holds it exclusively while it sweeps grants, so a redemption either commits in
   * time for the sweep or waits and sees the account closed. The rest is the order
   * create and revoke take. Taking the code row first instead deadlocks against
   * them: they hold the experiment row and reach for the code row, and a redemption
   * holding the code row would be reaching back the other way. Approval claims its
   * request before inserting the grant, so redemption does the same and those two
   * cannot wait on each other either.
   */
  async execute(code: string, userId: string): Promise<Result<RedeemJoinCodeResponse>> {
    this.logger.log({ msg: "Redeeming a join code", operation: "redeem-join-code", userId });

    try {
      return success(await this.redeem(code, userId));
    } catch (error) {
      if (error instanceof AppError) {
        return failure(error);
      }

      this.logger.error({
        msg: "Failed to redeem join code",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "redeem-join-code",
        userId,
        error,
      });
      return failure(AppError.internal("Failed to redeem join code"));
    }
  }

  private redeem(code: string, userId: string): Promise<RedeemJoinCodeResponse> {
    return this.joinCodeRepository.transaction(async (tx) => {
      // Unlocked, and only to learn which experiment to lock. `experiment_id` is
      // written once at insert and never rewritten, so it cannot go stale; every
      // value the refusal below rests on is re-read under both locks.
      const unlocked = await this.joinCodeRepository.readByCode(tx, code);
      if (!unlocked) {
        throw joinCodeNotFound();
      }

      if (!(await lockUserAccount(tx, userId))) {
        throw AppError.forbidden(ACCOUNT_UNAVAILABLE_MESSAGE);
      }

      // Shared, not exclusive: archiving updates this row, so an in-flight archive
      // blocks here until it commits and the refusal below then sees `archived`,
      // while thirty students redeeming at once still pass through together.
      const experiment = await this.joinCodeRepository.lockExperiment(
        tx,
        unlocked.experimentId,
        "share",
      );
      if (!experiment) {
        throw AppError.internal("Failed to redeem join code");
      }

      // Now the code row, in the same order create and revoke take the two. Whoever
      // commits first wins: a redemption arriving after a revocation reads
      // `revokedAt` set here rather than the value the unlocked read saw.
      const joinCode = await this.joinCodeRepository.lockByCode(tx, code);
      if (!joinCode) {
        throw joinCodeNotFound();
      }

      const refusal = joinCodeRefusal(joinCode, experiment, new Date());
      if (refusal) {
        throw refusal;
      }

      // Asked on the transaction's own handle, against the rows it holds. A double
      // scan, or a scan by someone who is already in the owning organization, is a
      // success with no writes at all — the counter must not move for it.
      const decision = await this.authz.can(
        userId,
        { resourceType: "experiment", resourceId: experiment.id, action: "contribute" },
        tx,
      );
      if (decision.allow) {
        return { experimentId: experiment.id, outcome: "already_member" as const };
      }

      if (!(await isLivingUser(tx, userId))) {
        throw AppError.forbidden(ACCOUNT_UNAVAILABLE_MESSAGE);
      }

      // The user's own pending request is moot now that they are in. Conditional on
      // `pending`, so an approval that committed in between is not overwritten.
      await this.joinRequestRepository.cancelPendingForUser(tx, experiment.id, userId, userId);

      const granted = await insertJoinGrant(tx, {
        experimentId: experiment.id,
        userId,
        // Whoever made the code authorized the access, which is the whole audit trail.
        createdBy: joinCode.createdBy,
      });

      // Only where a grant was actually written: two simultaneous redemptions insert
      // one row between them, and a redemption that loses to an approval writes none.
      if (granted) {
        await this.joinCodeRepository.incrementRedemptionCount(tx, joinCode.id);
      }

      return { experimentId: experiment.id, outcome: "joined" as const };
    });
  }
}
