import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import type { ExperimentDto } from "../../../../experiments/core/models/experiment.model";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import type { ExperimentDeviceDto } from "../../../core/models/experiment-device.model";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";

@Injectable()
export class ListExperimentDevicesUseCase {
  private readonly logger = new Logger(ListExperimentDevicesUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDeviceRepository: ExperimentDeviceRepository,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async execute(experimentId: string, userId: string): Promise<Result<ExperimentDeviceDto[]>> {
    this.logger.log({
      msg: "Listing experiment devices",
      operation: "listExperimentDevices",
      experimentId,
      userId,
    });

    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(async ({ experiment }: { experiment: ExperimentDto | null }) => {
      if (!experiment) {
        return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
      }

      // Devices are operational infrastructure, not published results:
      // org-role and grant readers see them, the public-read tier (anyone,
      // on a public experiment) does not.
      const decision = await this.authorizationService.can(userId, {
        resourceType: "experiment",
        resourceId: experimentId,
        action: "read",
      });
      if (!decision.allow || decision.reason === "public") {
        return failure(
          AppError.forbidden("Only experiment collaborators or managers can view its devices"),
        );
      }

      return this.experimentDeviceRepository.listByExperiment(experimentId);
    });
  }
}
