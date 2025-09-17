import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

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
    this.logger.log("Starting embargo expiration processing...");

    try {
      const expiredExperimentsResult = await this.experimentRepository.findExpiredEmbargoes();

      if (expiredExperimentsResult.isFailure()) {
        this.logger.error("Failed to fetch expired embargoes:", expiredExperimentsResult.error);
        return;
      }

      const experiments = expiredExperimentsResult.value;

      if (experiments.length === 0) {
        this.logger.log("No expired embargoes found");
        return;
      }

      this.logger.log(`Found ${experiments.length} experiment(s) with expired embargoes`);

      // Process each expired experiment
      let successCount = 0;
      let failureCount = 0;

      for (const experiment of experiments) {
        const updateResult = await this.experimentRepository.update(experiment.id, {
          visibility: "public",
        });

        if (updateResult.isSuccess()) {
          successCount++;
          this.logger.log(
            `Successfully updated experiment "${experiment.name}" (ID: ${experiment.id}) to public visibility`,
          );
        } else {
          failureCount++;
          this.logger.error(
            `Failed to update experiment "${experiment.name}" (ID: ${experiment.id}):`,
            updateResult.error,
          );
        }
      }

      this.logger.log(
        `Embargo processing completed. Success: ${successCount}, Failures: ${failureCount}`,
      );
    } catch (error) {
      this.logger.error("Unexpected error during embargo processing:", error);
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
    this.logger.log("Manual embargo processing triggered");

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
