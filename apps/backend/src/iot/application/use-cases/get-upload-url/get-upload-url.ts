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

  async execute(experimentId: string, userId: string): Promise<Result<IotUploadUrl>> {
    this.logger.log({
      msg: "Generating IoT upload URL",
      operation: "getIotUploadUrl",
      experimentId,
      userId,
    });

    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(async ({ experiment, hasAccess }) => {
      if (!experiment) {
        this.logger.warn({
          msg: "Experiment not found",
          operation: "getIotUploadUrl",
          experimentId,
        });
        return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
      }

      if (!hasAccess) {
        this.logger.warn({
          msg: "User is not a member of experiment",
          operation: "getIotUploadUrl",
          experimentId,
          userId,
        });
        return failure(AppError.forbidden("Only experiment members can upload IoT data"));
      }

      return this.awsPort.getIotUploadUrl(experimentId);
    });
  }
}
