import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
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

  @TsRestHandler(contract.experiments.createJoinRequest)
  createJoinRequest(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.createJoinRequest, async ({ params, body }) => {
      const result = await this.requestJoinExperimentUseCase.execute(
        params.id,
        session.user.id,
        body.message,
      );

      if (result.isSuccess()) {
        const formatted = formatDates(result.value.joinRequest);
        return {
          status: result.value.created ? (StatusCodes.CREATED as const) : (StatusCodes.OK as const),
          body: formatted,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.listJoinRequests)
  listJoinRequests(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.listJoinRequests, async ({ params }) => {
      const result = await this.listExperimentJoinRequestsUseCase.execute(
        params.id,
        session.user.id,
      );

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK as const,
          body: formatDatesList(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.getMyJoinRequest)
  getMyJoinRequest(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.getMyJoinRequest, async ({ params }) => {
      const result = await this.getMyJoinRequestUseCase.execute(params.id, session.user.id);

      if (result.isSuccess()) {
        if (!result.value) {
          return {
            status: StatusCodes.NOT_FOUND as const,
            body: { message: "No pending join request" },
          };
        }
        return {
          status: StatusCodes.OK as const,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.approveJoinRequest)
  approveJoinRequest(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.approveJoinRequest, async ({ params }) => {
      const result = await this.approveJoinRequestUseCase.execute(
        params.id,
        params.requestId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK as const,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.rejectJoinRequest)
  rejectJoinRequest(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.rejectJoinRequest, async ({ params }) => {
      const result = await this.rejectJoinRequestUseCase.execute(
        params.id,
        params.requestId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK as const,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.cancelJoinRequest)
  cancelJoinRequest(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.cancelJoinRequest, async ({ params }) => {
      const result = await this.cancelJoinRequestUseCase.execute(
        params.id,
        params.requestId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return {
          status: StatusCodes.NO_CONTENT as const,
          body: null,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
