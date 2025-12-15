import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";

import { contract } from "@repo/api";
import type { User } from "@repo/auth/types";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
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
        return {
          status: 201,
          body: {
            requestId: result.value.requestId,
            userId: result.value.userId,
            userEmail: result.value.userEmail,
            sourcePlatform: result.value.sourcePlatform,
            projectIdOld: result.value.projectIdOld,
            projectUrlOld: result.value.projectUrlOld,
            status: result.value.status as "pending" | "completed" | "rejected",
            requestedAt: result.value.requestedAt.toISOString(),
          },
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
        return {
          status: 200,
          body: result.value.map((request) => ({
            requestId: request.requestId,
            userId: request.userId,
            userEmail: request.userEmail,
            sourcePlatform: request.sourcePlatform,
            projectIdOld: request.projectIdOld,
            projectUrlOld: request.projectUrlOld,
            status: request.status as "pending" | "completed" | "rejected",
            requestedAt: request.requestedAt.toISOString(),
          })),
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
