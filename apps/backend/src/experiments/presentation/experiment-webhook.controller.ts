import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { HmacGuard } from "../../common/guards/hmac.guard";
import { handleFailure } from "../../common/utils/fp-utils";
import { UpdateProvisioningStatusUseCase } from "../application/use-cases/update-provisioning-status/update-provisioning-status";

@Controller()
@UseGuards(HmacGuard)
export class ExperimentWebhookController {
  private readonly logger = new Logger(ExperimentWebhookController.name);

  constructor(private readonly updateProvisioningStatusUseCase: UpdateProvisioningStatusUseCase) {}

  @TsRestHandler(contract.experiments.updateProvisioningStatus)
  handleWorkflowStatus() {
    return tsRestHandler(
      contract.experiments.updateProvisioningStatus,
      async ({ body, params }) => {
        const result = await this.updateProvisioningStatusUseCase.execute({
          experimentId: params.id,
          status: body.status,
        });

        if (result.isSuccess()) {
          const experimentStatus = result.value;
          this.logger.log(
            `Experiment provisioning status updated successfully: ${experimentStatus} for experiment ID ${params.id}`,
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
      },
    );
  }
}
