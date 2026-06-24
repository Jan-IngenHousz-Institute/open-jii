import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentJoinRequestsOrpcContract } from "@repo/api/domains/experiment/experiment-join-requests.orpc";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { AppError } from "../../common/utils/fp-utils";
import { throwOrpcError, throwOrpcFailure } from "../../common/utils/orpc-fp";
import { ApproveJoinRequestUseCase } from "../application/use-cases/experiment-join-requests/approve-join-request";
import { CancelJoinRequestUseCase } from "../application/use-cases/experiment-join-requests/cancel-join-request";
import { GetMyJoinRequestUseCase } from "../application/use-cases/experiment-join-requests/get-my-join-request";
import { ListExperimentJoinRequestsUseCase } from "../application/use-cases/experiment-join-requests/list-experiment-join-requests";
import { RejectJoinRequestUseCase } from "../application/use-cases/experiment-join-requests/reject-join-request";
import { RequestJoinExperimentUseCase } from "../application/use-cases/experiment-join-requests/request-join-experiment";

@Controller()
export class ExperimentJoinRequestsController {
  private readonly logger = new Logger(ExperimentJoinRequestsController.name);

  constructor(
    private readonly requestJoinExperimentUseCase: RequestJoinExperimentUseCase,
    private readonly listExperimentJoinRequestsUseCase: ListExperimentJoinRequestsUseCase,
    private readonly getMyJoinRequestUseCase: GetMyJoinRequestUseCase,
    private readonly approveJoinRequestUseCase: ApproveJoinRequestUseCase,
    private readonly rejectJoinRequestUseCase: RejectJoinRequestUseCase,
    private readonly cancelJoinRequestUseCase: CancelJoinRequestUseCase,
  ) {}

  @Implement(experimentJoinRequestsOrpcContract.createJoinRequest)
  createJoinRequest(@Session() session: UserSession) {
    return implement(experimentJoinRequestsOrpcContract.createJoinRequest).handler(async ({ input }) => {
      const result = await this.requestJoinExperimentUseCase.execute(
        input.id,
        session.user.id,
        input.message,
      );

      if (result.isSuccess()) {
        return formatDates(result.value.joinRequest);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentJoinRequestsOrpcContract.listJoinRequests)
  listJoinRequests(@Session() session: UserSession) {
    return implement(experimentJoinRequestsOrpcContract.listJoinRequests).handler(async ({ input }) => {
      const result = await this.listExperimentJoinRequestsUseCase.execute(input.id, session.user.id);

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentJoinRequestsOrpcContract.getMyJoinRequest)
  getMyJoinRequest(@Session() session: UserSession) {
    return implement(experimentJoinRequestsOrpcContract.getMyJoinRequest).handler(async ({ input }) => {
      const result = await this.getMyJoinRequestUseCase.execute(input.id, session.user.id);

      if (result.isSuccess()) {
        if (!result.value) {
          return throwOrpcError(AppError.notFound("No pending join request"), this.logger);
        }
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentJoinRequestsOrpcContract.approveJoinRequest)
  approveJoinRequest(@Session() session: UserSession) {
    return implement(experimentJoinRequestsOrpcContract.approveJoinRequest).handler(async ({ input }) => {
      const result = await this.approveJoinRequestUseCase.execute(
        input.id,
        input.requestId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentJoinRequestsOrpcContract.rejectJoinRequest)
  rejectJoinRequest(@Session() session: UserSession) {
    return implement(experimentJoinRequestsOrpcContract.rejectJoinRequest).handler(async ({ input }) => {
      const result = await this.rejectJoinRequestUseCase.execute(
        input.id,
        input.requestId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentJoinRequestsOrpcContract.cancelJoinRequest)
  cancelJoinRequest(@Session() session: UserSession) {
    return implement(experimentJoinRequestsOrpcContract.cancelJoinRequest).handler(async ({ input }) => {
      const result = await this.cancelJoinRequestUseCase.execute(
        input.id,
        input.requestId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return undefined;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }
}
