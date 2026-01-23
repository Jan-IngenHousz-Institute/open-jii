import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { TransferRequestStatus } from "@repo/api";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { CreateTransferRequestUseCase } from "../application/use-cases/project-transfer-requests/create-transfer-request/create-transfer-request";
import { ListTransferRequestsUseCase } from "../application/use-cases/project-transfer-requests/list-transfer-requests/list-transfer-requests";

@Controller()
export class ProjectTransferRequestsController {
  private readonly logger = new Logger(ProjectTransferRequestsController.name);

  constructor(
    private readonly createTransferRequestUseCase: CreateTransferRequestUseCase,
    private readonly listTransferRequestsUseCase: ListTransferRequestsUseCase,
  ) {}

  @TsRestHandler(contract.experiments.createTransferRequest)
  createTransferRequest(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.createTransferRequest, async ({ body }) => {
      this.logger.log({
        msg: "Creating transfer request",
        operation: "createTransferRequest",
        userId: session.user.id,
      });

      const result = await this.createTransferRequestUseCase.execute(
        session.user.id,
        session.user.email,
        body,
      );

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
  listTransferRequests(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.listTransferRequests, async () => {
      this.logger.log({
        msg: "Listing transfer requests",
        operation: "listTransferRequests",
        userId: session.user.id,
      });

      const result = await this.listTransferRequestsUseCase.execute(session.user.id);

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
