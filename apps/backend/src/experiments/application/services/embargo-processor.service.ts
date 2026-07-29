import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { ErrorCodes } from "../../../common/utils/error-codes";
import { resolveVisibilityTransition } from "../../../visibility/visibility-transition";
import { ExperimentRepository } from "../../core/repositories/experiment.repository";

@Injectable()
export class EmbargoProcessorService {
  private readonly logger = new Logger(EmbargoProcessorService.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  /**
   * Runs every day at midnight UTC to process expired embargoes
   * This will find all private experiments where the embargo period has expired
   * and automatically change their visibility to public
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    timeZone: "UTC",
  })
  async processExpiredEmbargoes(): Promise<void> {
    this.logger.log({
      msg: "Starting embargo expiration processing",
      operation: "processExpiredEmbargoes",
    });

    try {
      const expiredExperimentsResult = await this.experimentRepository.findExpiredEmbargoes();

      if (expiredExperimentsResult.isFailure()) {
        this.logger.error({
          msg: "Failed to fetch expired embargoes",
          errorCode: ErrorCodes.EMBARGO_PROCESSING_FAILED,
          operation: "processExpiredEmbargoes",
          error: expiredExperimentsResult.error,
        });
        return;
      }

      const experiments = expiredExperimentsResult.value;

      if (experiments.length === 0) {
        this.logger.log({
          msg: "No expired embargoes found",
          operation: "processExpiredEmbargoes",
          count: 0,
        });
        return;
      }

      this.logger.log({
        msg: "Found expired embargoes",
        operation: "processExpiredEmbargoes",
        count: experiments.length,
      });

      // Process each expired experiment
      let successCount = 0;
      let failureCount = 0;

      for (const experiment of experiments) {
        // Route the publish through the single monotonic-visibility helper so
        // the embargo cron obeys exactly the same rule as `setVisibility`.
        // findExpiredEmbargoes only returns private experiments, so this always
        // resolves to a valid private→public transition — belt-and-braces.
        const transition = resolveVisibilityTransition(experiment.visibility, "public");
        if (transition.isFailure()) {
          failureCount++;
          this.logger.error({
            msg: "Skipped embargo publish — illegal visibility transition",
            errorCode: ErrorCodes.EMBARGO_PROCESSING_FAILED,
            operation: "processExpiredEmbargoes",
            experimentId: experiment.id,
            error: transition.error,
          });
          continue;
        }
        // Already public (no-op) — nothing to persist. Not expected given the
        // private-only query, so skip silently without counting it either way.
        if (!transition.value.changed) {
          continue;
        }

        const updateResult = await this.experimentRepository.update(experiment.id, {
          visibility: "public",
        });

        if (updateResult.isSuccess()) {
          successCount++;
          this.logger.log({
            msg: "Experiment embargo expired and made public",
            operation: "processExpiredEmbargoes",
            experimentId: experiment.id,
            status: "success",
          });
        } else {
          failureCount++;
          this.logger.error({
            msg: "Failed to update experiment embargo",
            errorCode: ErrorCodes.EMBARGO_PROCESSING_FAILED,
            operation: "processExpiredEmbargoes",
            experimentId: experiment.id,
            error: updateResult.error,
          });
        }
      }

      this.logger.log({
        msg: "Embargo processing completed",
        operation: "processExpiredEmbargoes",
        totalProcessed: experiments.length,
        successCount,
        failureCount,
      });
    } catch (error) {
      this.logger.error({
        msg: "Unexpected error during embargo processing",
        errorCode: ErrorCodes.EMBARGO_PROCESSING_FAILED,
        operation: "processExpiredEmbargoes",
        error,
      });
    }
  }

  /**
   * Manual method to trigger embargo processing (useful for testing or manual runs)
   */
  async processExpiredEmbargoesManually(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    this.logger.log({
      msg: "Manual embargo processing triggered",
      operation: "processExpiredEmbargoesManually",
    });

    const expiredExperimentsResult = await this.experimentRepository.findExpiredEmbargoes();

    if (expiredExperimentsResult.isFailure()) {
      throw new Error(
        `Failed to fetch expired embargoes: ${expiredExperimentsResult.error.message}`,
      );
    }

    const experiments = expiredExperimentsResult.value;
    let succeeded = 0;
    let failed = 0;

    for (const experiment of experiments) {
      // Same single-implementation publish path as the scheduled run.
      const transition = resolveVisibilityTransition(experiment.visibility, "public");
      if (transition.isFailure()) {
        failed++;
        continue;
      }
      if (!transition.value.changed) {
        continue;
      }

      const updateResult = await this.experimentRepository.update(experiment.id, {
        visibility: "public",
      });

      if (updateResult.isSuccess()) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return {
      processed: experiments.length,
      succeeded,
      failed,
    };
  }
}
