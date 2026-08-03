import { Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import type { ExperimentDto } from "../../../../experiments/core/models/experiment.model";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";

@Injectable()
export class RemoveExperimentDeviceUseCase {
  private readonly logger = new Logger(RemoveExperimentDeviceUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentDeviceRepository: ExperimentDeviceRepository,
  ) {}

  async execute(experimentId: string, deviceId: string, userId: string): Promise<Result<void>> {
    this.logger.log({
      msg: "Detaching device from experiment",
      operation: "removeExperimentDevice",
      experimentId,
      deviceId,
      userId,
    });

    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({
        experiment,
        hasAccess,
      }: {
        experiment: ExperimentDto | null;
        hasAccess: boolean;
      }) => {
        if (!experiment) {
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        // Detach stays allowed on archived experiments: it is cleanup, and the
        // only way to stop re-issued configs from ever including the binding.
        if (!hasAccess) {
          return failure(AppError.forbidden("Only experiment members can detach its devices"));
        }

        const removeResult = await this.experimentDeviceRepository.removeDevice(
          experimentId,
          deviceId,
        );
        if (removeResult.isFailure()) {
          return failure(removeResult.error);
        }

        if (!removeResult.value) {
          return failure(
            AppError.notFound(`Device with ID ${deviceId} is not attached to this experiment`),
          );
        }

        return success(undefined);
      },
    );
  }
}
