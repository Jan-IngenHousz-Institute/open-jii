import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import type { ExperimentTransferRequestStatus } from "@repo/api/domains/experiment/experiment.schema";
import { experimentTransferRequestsContract } from "@repo/api/domains/experiment/transfer-requests/experiment-transfer-requests.contract";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { CreateTransferRequestUseCase } from "../application/use-cases/project-transfer-requests/create-transfer-request/create-transfer-request";
import { ListTransferRequestsUseCase } from "../application/use-cases/project-transfer-requests/list-transfer-requests/list-transfer-requests";

@Controller()
export class ProjectTransferRequestsController {
  private readonly logger = new Logger(ProjectTransferRequestsController.name);

  constructor(
    private readonly createTransferRequestUseCase: CreateTransferRequestUseCase,
    private readonly listTransferRequestsUseCase: ListTransferRequestsUseCase,
  ) {}

  @Implement(experimentTransferRequestsContract.createTransferRequest)
  createTransferRequest(@Session() session: UserSession) {
    return implement(experimentTransferRequestsContract.createTransferRequest).handler(
      async ({ input }) => {
        const result = await this.createTransferRequestUseCase.execute(
          session.user.id,
          session.user.email,
          input,
        );

        if (result.isSuccess()) {
          return formatDates({
            ...result.value,
            status: result.value.status as ExperimentTransferRequestStatus,
          });
        }

        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentTransferRequestsContract.listTransferRequests)
  listTransferRequests(@Session() session: UserSession) {
    return implement(experimentTransferRequestsContract.listTransferRequests).handler(async () => {
      const result = await this.listTransferRequestsUseCase.execute(session.user.id);

      if (result.isSuccess()) {
        const requests = result.value.map((request) => ({
          ...request,
          status: request.status as ExperimentTransferRequestStatus,
        }));
        return formatDatesList(requests);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }
}
