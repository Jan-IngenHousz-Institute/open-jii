import { Injectable, Logger } from "@nestjs/common";

import { Result, success } from "../../../../common/utils/fp-utils";
import { UserRepository } from "../../../../users/core/repositories/user.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

export interface AdminTransfer {
  experimentId: string;
  targetUserId: string;
}

export interface AdminTransferResult {
  experimentId: string;
  success: boolean;
  error?: string;
}

/**
 * Hands experiment admin rights off in bulk so a user can clear their account-deletion
 * blockers in one step. For each (experiment, target):
 *   - the caller must currently be an admin of the experiment (authorization);
 *   - the target receives an `admin` grant, the surface that owns
 *     access tiers.
 *
 * This is intentionally allowed on archived experiments — it is the single controlled
 * path for ownership hand-off during account deletion, and it talks to the repository
 * directly rather than going through the guarded sharing use cases. Archived
 * experiments stay immutable everywhere else.
 *
 * Each transfer succeeds or fails independently; the caller gets a per-experiment
 * result so the UI can keep any rows that could not be resolved.
 */
@Injectable()
export class TransferExperimentAdminUseCase {
  private readonly logger = new Logger(TransferExperimentAdminUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(
    transfers: AdminTransfer[],
    currentUserId: string,
  ): Promise<Result<AdminTransferResult[]>> {
    this.logger.log({
      msg: "Transferring experiment admin rights",
      operation: "transfer-experiment-admin",
      userId: currentUserId,
      transferCount: transfers.length,
    });

    const results: AdminTransferResult[] = [];
    for (const transfer of transfers) {
      results.push(await this.transferOne(transfer, currentUserId));
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.length - succeeded;
    const status = failed === 0 ? "success" : succeeded === 0 ? "failed" : "partial";

    this.logger.log({
      msg: "Finished transferring experiment admin rights",
      operation: "transfer-experiment-admin",
      userId: currentUserId,
      succeeded,
      failed,
      status,
    });

    return success(results);
  }

  private async transferOne(
    { experimentId, targetUserId }: AdminTransfer,
    currentUserId: string,
  ): Promise<AdminTransferResult> {
    const fail = (error: string): AdminTransferResult => {
      this.logger.warn({
        msg: "Admin transfer skipped",
        operation: "transfer-experiment-admin",
        experimentId,
        targetUserId,
        userId: currentUserId,
        reason: error,
      });
      return { experimentId, success: false, error };
    };

    // The caller must be an admin of this experiment to hand its admin rights off.
    const accessResult = await this.experimentRepository.checkAccess(experimentId, currentUserId);
    if (accessResult.isFailure()) {
      return fail("Failed to verify experiment access");
    }
    const { experiment, isAdmin } = accessResult.value;
    if (!experiment) {
      return fail("Experiment not found");
    }
    if (!isAdmin) {
      return fail("Only an admin can transfer admin rights");
    }

    // The target must be a real, active user before we hand them admin rights.
    const targetProfileResult = await this.userRepository.findUserProfile(targetUserId);
    if (targetProfileResult.isFailure()) {
      return fail("Failed to verify target user");
    }
    const targetProfile = targetProfileResult.value;
    if (!targetProfile || targetProfile.activated === false) {
      return fail("Target user is not available");
    }

    // Give the target a direct `admin` grant — idempotent, so a re-run (or a target
    // who already holds admin/owner) is a harmless no-op.
    const grantResult = await this.experimentRepository.ensureDirectAdminGrant(
      experimentId,
      targetUserId,
      currentUserId,
    );
    if (grantResult.isFailure()) {
      return fail("Failed to assign admin role");
    }

    return { experimentId, success: true };
  }
}
