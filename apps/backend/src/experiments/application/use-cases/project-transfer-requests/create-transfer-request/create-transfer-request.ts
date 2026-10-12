import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../../common/utils/error-codes";
import type { Result } from "../../../../../common/utils/fp-utils";
import { success, failure, AppError } from "../../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../../notifications/application/services/notification-dispatch.service";
import type { BaseTransferRequest } from "../../../../core/models/project-transfer-request.model";
import { ProjectTransferRequestsRepository } from "../../../../core/repositories/project-transfer-requests.repository";

interface CreateTransferRequestInput {
  projectIdOld: string;
  projectUrlOld: string;
}

@Injectable()
export class CreateTransferRequestUseCase {
  private readonly logger = new Logger(CreateTransferRequestUseCase.name);

  constructor(
    private readonly transferRequestsRepository: ProjectTransferRequestsRepository,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async execute(
    userId: string,
    userEmail: string | null | undefined,
    input: CreateTransferRequestInput,
  ): Promise<Result<BaseTransferRequest>> {
    this.logger.log({
      msg: "Creating transfer request",
      operation: "create_transfer_request",
      userId,
      projectIdOld: input.projectIdOld,
    });

    // The transfer request row carries the requester's address to Databricks.
    if (!userEmail) {
      this.logger.warn({
        msg: "User does not have an email address",
        operation: "create_transfer_request",
        userId,
      });
      return failure(AppError.badRequest("User account does not have an email address"));
    }

    // Check if user already has a transfer request for this project
    const existingRequestResult = await this.transferRequestsRepository.findExistingRequest(
      userId,
      input.projectIdOld,
    );

    if (existingRequestResult.isFailure()) {
      return failure(existingRequestResult.error);
    }

    if (existingRequestResult.value) {
      this.logger.warn({
        msg: "User already has a transfer request for project",
        operation: "create_transfer_request",
        userId,
        projectIdOld: input.projectIdOld,
        requestStatus: existingRequestResult.value.status,
      });
      return failure(
        AppError.forbidden(
          `You already have a transfer request for this project (Status: ${existingRequestResult.value.status})`,
        ),
      );
    }

    // Create the transfer request
    const createResult = await this.transferRequestsRepository.createTransferRequest({
      userId,
      userEmail,
      sourcePlatform: "photosynq",
      projectIdOld: input.projectIdOld,
      projectUrlOld: input.projectUrlOld,
      status: "pending",
    });

    if (createResult.isFailure()) {
      return failure(createResult.error);
    }

    const dispatched = await this.notifications.dispatch({
      type: "project_transfer_requested",
      recipientIds: [userId],
      params: { projectId: input.projectIdOld, projectUrl: input.projectUrlOld },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to notify the requester, the transfer request was still created",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "create_transfer_request",
        userId,
        projectIdOld: input.projectIdOld,
        error: dispatched.error,
      });
    }

    return success(createResult.value);
  }
}
