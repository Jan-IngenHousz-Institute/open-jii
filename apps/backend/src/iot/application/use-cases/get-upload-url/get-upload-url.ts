import { Inject, Injectable, Logger } from "@nestjs/common";

import { GUEST_UPLOAD_MAX_BYTES } from "@repo/api/shared/guest";

import { DEMO_MODE_PORT } from "../../../../authorization/core/ports/demo-mode.port";
import type { DemoModePort } from "../../../../authorization/core/ports/demo-mode.port";
import { AppError, Result, failure } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import { GUEST_IDENTITY_PORT } from "../../../../users/core/ports/guest-identity.port";
import type { GuestIdentityPort } from "../../../../users/core/ports/guest-identity.port";
import type { AwsPort, IotUploadUrl } from "../../../core/ports/aws.port";
import { AWS_PORT } from "../../../core/ports/aws.port";

@Injectable()
export class GetIotUploadUrlUseCase {
  private readonly logger = new Logger(GetIotUploadUrlUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly experimentRepository: ExperimentRepository,
    @Inject(GUEST_IDENTITY_PORT) private readonly guests: GuestIdentityPort,
    @Inject(DEMO_MODE_PORT) private readonly demo: DemoModePort,
  ) {}

  async execute(
    experimentId: string,
    userId?: string,
    contentLength?: number,
  ): Promise<Result<IotUploadUrl>> {
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

    const identity = userId ? await this.guests.findIdentity(userId) : null;
    if (userId && identity?.isAnonymous) {
      if (experimentResult.value.organizationType !== "demo" || !(await this.demo.isEnabled())) {
        return failure(
          AppError.forbidden(
            "Guest uploads are limited to the available demo",
            "GUEST_ACTION_FORBIDDEN",
          ),
        );
      }
      if (
        contentLength === undefined ||
        !Number.isInteger(contentLength) ||
        contentLength <= 0 ||
        contentLength > GUEST_UPLOAD_MAX_BYTES
      ) {
        return failure(
          AppError.badRequest("Guest uploads must be at most 1 MiB", "GUEST_UPLOAD_SIZE_INVALID"),
        );
      }
      const quota = await this.guests.takeQuota(userId, "upload");
      if (!quota.allowed)
        return failure(
          new AppError(
            `Guest limit reached. Try again in ${quota.retryAfterSeconds} seconds`,
            "GUEST_RATE_LIMITED",
            429,
          ),
        );
      return this.awsPort.getIotUploadUrl(experimentResult.value.id, {
        guestContentLength: contentLength,
      });
    }
    return this.awsPort.getIotUploadUrl(experimentId);
  }
}
