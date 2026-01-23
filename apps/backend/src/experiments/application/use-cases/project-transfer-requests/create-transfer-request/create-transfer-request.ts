import { Injectable, Logger, Inject } from "@nestjs/common";

import type { Result } from "../../../../../common/utils/fp-utils";
import { success, failure, AppError } from "../../../../../common/utils/fp-utils";
import type { BaseTransferRequest } from "../../../../core/models/project-transfer-request.model";
import { EMAIL_PORT } from "../../../../core/ports/email.port";
import type { EmailPort } from "../../../../core/ports/email.port";
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
    @Inject(EMAIL_PORT) private readonly emailPort: EmailPort,
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

    // Validate that the user email is provided
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

    // Send confirmation email
    const emailResult = await this.emailPort.sendTransferRequestConfirmation(
      userEmail,
      input.projectIdOld,
      input.projectUrlOld,
    );

    if (emailResult.isFailure()) {
      this.logger.warn({
        msg: "Failed to send transfer request confirmation email",
        operation: "create_transfer_request",
        userId,
        projectIdOld: input.projectIdOld,
        error: emailResult.error,
      });
      // Don't fail the whole operation, just log the warning
    }

    return success(createResult.value);
  }
}
