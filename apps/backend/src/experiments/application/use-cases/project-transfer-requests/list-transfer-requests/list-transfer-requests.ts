import { Injectable, Logger } from "@nestjs/common";

import type { Result } from "../../../../../common/utils/fp-utils";
import { success, failure, AppError } from "../../../../../common/utils/fp-utils";
import type { BaseTransferRequest } from "../../../../core/models/project-transfer-request.model";
import { ProjectTransferRequestsRepository } from "../../../../core/repositories/project-transfer-requests.repository";

@Injectable()
export class ListTransferRequestsUseCase {
  private readonly logger = new Logger(ListTransferRequestsUseCase.name);

  constructor(private readonly transferRequestsRepository: ProjectTransferRequestsRepository) {}

  async execute(userId?: string): Promise<Result<BaseTransferRequest[]>> {
    this.logger.log(`Listing transfer requests${userId ? ` for user ${userId}` : ""}`);

    // List the transfer requests
    const listResult = await this.transferRequestsRepository.listTransferRequests(userId);

    if (listResult.isFailure()) {
      return failure(AppError.internal(listResult.error.message));
    }

    return success(listResult.value);
  }
}
