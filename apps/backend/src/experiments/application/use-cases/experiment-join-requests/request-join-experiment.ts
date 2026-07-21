import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import type { ExperimentJoinRequestDto } from "../../../core/models/experiment-join-request.model";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { EMAIL_PORT } from "../../../core/ports/email.port";
import type { EmailPort } from "../../../core/ports/email.port";
import { ExperimentJoinRequestRepository } from "../../../core/repositories/experiment-join-request.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class RequestJoinExperimentUseCase {
  private readonly logger = new Logger(RequestJoinExperimentUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly joinRequestRepository: ExperimentJoinRequestRepository,
    @Inject(EMAIL_PORT) private readonly emailPort: EmailPort,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    message: string | undefined,
  ): Promise<Result<{ joinRequest: ExperimentJoinRequestDto; created: boolean }>> {
    this.logger.log({
      msg: "Creating join request",
      operation: "request-join-experiment",
      experimentId,
      userId,
    });

    const accessCheckResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessCheckResult.chain(
      async ({ experiment, isMember }: { experiment: ExperimentDto | null; isMember: boolean }) => {
        if (!experiment) {
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (experiment.status === "archived") {
          return failure(AppError.forbidden("Cannot request to join an archived experiment"));
        }

        // Private experiments are hidden from non-members; deny join requests for them
        // so the experiment's privacy is preserved.
        if (experiment.visibility !== "public") {
          return failure(AppError.forbidden("This experiment is not open to join requests"));
        }

        if (isMember) {
          return failure(
            AppError.conflict("You are already a member of this experiment", ErrorCodes.CONFLICT),
          );
        }

        // Dedup: return any existing pending request without creating a new one
        const existingResult = await this.joinRequestRepository.findPendingByExperimentAndUser(
          experimentId,
          userId,
        );

        if (existingResult.isFailure()) {
          return failure(AppError.internal("Failed to check existing join request"));
        }

        if (existingResult.value) {
          return success({ joinRequest: existingResult.value, created: false });
        }

        const createResult = await this.joinRequestRepository.create(experimentId, userId, message);
        if (createResult.isFailure()) {
          this.logger.error({
            msg: "Failed to create join request",
            errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
            operation: "request-join-experiment",
            experimentId,
            userId,
            error: createResult.error,
          });
          return failure(AppError.internal("Failed to create join request"));
        }

        const joinRequest = createResult.value;
        await this.notifyAdmins(experiment, joinRequest);

        return success({ joinRequest, created: true });
      },
    );
  }

  private async notifyAdmins(
    experiment: ExperimentDto,
    joinRequest: ExperimentJoinRequestDto,
  ): Promise<void> {
    const adminEmailsResult = await this.joinRequestRepository.listAdminEmails(experiment.id);
    if (adminEmailsResult.isFailure()) {
      this.logger.error({
        msg: "Failed to look up admin emails for join request notification",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "request-join-experiment",
        experimentId: experiment.id,
      });
      return;
    }

    const requesterName = `${joinRequest.user.firstName} ${joinRequest.user.lastName}`;

    for (const adminEmail of adminEmailsResult.value) {
      if (!adminEmail) continue;
      const emailResult = await this.emailPort.sendJoinRequestSubmittedNotification(
        experiment.id,
        experiment.name,
        requesterName,
        adminEmail,
        joinRequest.message ?? undefined,
      );

      if (emailResult.isFailure()) {
        this.logger.error({
          msg: "Failed to send join request notification to admin, request was still created",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "request-join-experiment",
          experimentId: experiment.id,
          adminEmail,
        });
      }
    }
  }
}
