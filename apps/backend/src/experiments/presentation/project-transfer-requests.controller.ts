import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract, TransferRequestStatus } from "@repo/api";
import type { User } from "@repo/auth/types";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { CreateTransferRequestUseCase } from "../application/use-cases/project-transfer-requests/create-transfer-request/create-transfer-request";
import { ListTransferRequestsUseCase } from "../application/use-cases/project-transfer-requests/list-transfer-requests/list-transfer-requests";

@Controller()
@UseGuards(AuthGuard)
export class ProjectTransferRequestsController {
  private readonly logger = new Logger(ProjectTransferRequestsController.name);

  constructor(
    private readonly createTransferRequestUseCase: CreateTransferRequestUseCase,
    private readonly listTransferRequestsUseCase: ListTransferRequestsUseCase,
  ) {}

  @TsRestHandler(contract.experiments.createTransferRequest)
  createTransferRequest(@CurrentUser() user: User) {
    return tsRestHandler(contract.experiments.createTransferRequest, async ({ body }) => {
      this.logger.log(`Creating transfer request for user ${user.id}`);

      const result = await this.createTransferRequestUseCase.execute(user.id, user.email, body);

      if (result.isSuccess()) {
        const request = {
          ...result.value,
          status: result.value.status as TransferRequestStatus,
        };

        return {
          status: StatusCodes.CREATED,
          body: formatDates(request),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.listTransferRequests)
  listTransferRequests(@CurrentUser() user: User) {
    return tsRestHandler(contract.experiments.listTransferRequests, async () => {
      this.logger.log(`Listing transfer requests for user ${user.id}`);

      const result = await this.listTransferRequestsUseCase.execute(user.id);

      if (result.isSuccess()) {
        const requests = result.value.map((request) => ({
          ...request,
          status: request.status as TransferRequestStatus,
        }));

        return {
          status: StatusCodes.OK,
          body: formatDatesList(requests),
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
