import { Inject, Injectable, Logger } from "@nestjs/common";

import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import type { AwsPort, IotUploadUrl } from "../../../core/ports/aws.port";
import { AWS_PORT } from "../../../core/ports/aws.port";

@Injectable()
export class GetIotUploadUrlUseCase {
  private readonly logger = new Logger(GetIotUploadUrlUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly experimentRepository: ExperimentRepository,
  ) {}

  async execute(experimentId: string): Promise<Result<IotUploadUrl>> {
    this.logger.log({
      msg: "Generating IoT upload URL",
      operation: "getIotUploadUrl",
      experimentId,
    });

    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }
    if (!experimentResult.value) {
      this.logger.warn({
        msg: "Experiment not found",
        operation: "getIotUploadUrl",
        experimentId,
      });
      return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
    }

    // Experiment membership is enforced by @CanContributeToExperiment.
    return this.awsPort.getIotUploadUrl(experimentId);
  }
}
