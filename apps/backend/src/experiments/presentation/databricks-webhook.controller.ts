import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { ApiKeyGuard } from "../../common/guards/api-key.guard";
import { handleFailure } from "../../common/utils/fp-utils";
import { UpdateProvisioningStatusUseCase } from "../application/use-cases/update-provisioning-status/update-provisioning-status";

@Controller()
export class DatabricksWebhookController {
  private readonly logger = new Logger(DatabricksWebhookController.name);

  constructor(private readonly updateProvisioningStatusUseCase: UpdateProvisioningStatusUseCase) {}

  @TsRestHandler(contract.webhooks.updateProvisioningStatus)
  @UseGuards(ApiKeyGuard)
  handleWorkflowStatus() {
    return tsRestHandler(contract.webhooks.updateProvisioningStatus, async ({ body }) => {
      this.logger.log(
        [
          "Received Databricks workflow status update:",
          `  experiment_id: ${body.experimentId}`,
          `  status: ${body.status}`,
          `  job_run_id: ${body.jobRunId}`,
          `  task_run_id: ${body.taskRunId}`,
          `  timestamp: ${body.timestamp}`,
        ].join("\n"),
      );

      // Delegate to the use case
      const result = await this.updateProvisioningStatusUseCase.execute({
        experimentId: body.experimentId,
        status: body.status,
      });

      if (result.isSuccess()) {
        const experimentStatus = result.value;
        this.logger.log(
          `Experiment provisioning status updated successfully: ${experimentStatus} for experiment ID ${body.experimentId}`,
        );
        return {
          status: StatusCodes.OK as const,
          body: {
            success: true,
            message: `Experiment status updated to ${experimentStatus}`,
          },
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
