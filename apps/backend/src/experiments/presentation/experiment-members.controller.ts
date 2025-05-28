import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { SessionUser } from "@repo/auth/config";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import {
  formatDates,
  formatDatesList,
} from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { AddExperimentMemberUseCase } from "../application/use-cases/experiment-members/add-experiment-member";
import { GetUsersNotOnExperimentUseCase } from "../application/use-cases/experiment-members/get-users-not-on-experiment";
import { ListExperimentMembersUseCase } from "../application/use-cases/experiment-members/list-experiment-members";
import { RemoveExperimentMemberUseCase } from "../application/use-cases/experiment-members/remove-experiment-member";

@Controller()
@UseGuards(AuthGuard)
export class ExperimentMembersController {
  private readonly logger = new Logger(ExperimentMembersController.name);

  constructor(
    private readonly listExperimentMembersUseCase: ListExperimentMembersUseCase,
    private readonly addExperimentMemberUseCase: AddExperimentMemberUseCase,
    private readonly removeExperimentMemberUseCase: RemoveExperimentMemberUseCase,
    private readonly getUsersNotOnExperimentUseCase: GetUsersNotOnExperimentUseCase,
  ) {}

  @TsRestHandler(contract.experiments.listExperimentMembers)
  listMembers(@CurrentUser() user: SessionUser) {
    return tsRestHandler(
      contract.experiments.listExperimentMembers,
      async ({ params }) => {
        const result = await this.listExperimentMembersUseCase.execute(
          params.id,
          user.id,
        );

        if (result.isSuccess()) {
          // Format dates to strings for the API contract
          const members = result.value;
          const formattedMembers = formatDatesList(members);

          return {
            status: StatusCodes.OK as const,
            body: formattedMembers,
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.addExperimentMember)
  addMember(@CurrentUser() user: SessionUser) {
    return tsRestHandler(
      contract.experiments.addExperimentMember,
      async ({ params, body }) => {
        const result = await this.addExperimentMemberUseCase.execute(
          params.id,
          body,
          user.id,
        );

        if (result.isSuccess()) {
          const member = result.value;
          // Format date to string for the API contract
          const formattedMember = formatDates(member);

          this.logger.log(
            `Member ${body.userId} added to experiment ${params.id} by user ${user.id}`,
          );

          return {
            status: StatusCodes.CREATED,
            body: formattedMember,
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.removeExperimentMember)
  removeMember(@CurrentUser() user: SessionUser) {
    return tsRestHandler(
      contract.experiments.removeExperimentMember,
      async ({ params }) => {
        const result = await this.removeExperimentMemberUseCase.execute(
          params.id,
          params.memberId,
          user.id,
        );

        if (result.isSuccess()) {
          this.logger.log(
            `Member ${params.memberId} removed from experiment ${params.id} by user ${user.id}`,
          );

          return {
            status: StatusCodes.NO_CONTENT,
            body: null,
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.getUsersNotOnExperiment)
  getUsersNotOnExperiment() {
    return tsRestHandler(
      contract.experiments.getUsersNotOnExperiment,
      async ({ params }) => {
        const result = await this.getUsersNotOnExperimentUseCase.execute(
          params.id,
        );
        if (result.isSuccess()) {
          // Format dates to strings for the API contract and ensure non-null values for the API contract
          const users = result.value;
          const formattedUsers = formatDatesList(users).map((user) => ({
            id: user.id,
            name: user.name || "",
            email: user.email || "",
          }));

          return {
            status: StatusCodes.OK as const,
            body: formattedUsers,
          };
        }
        return handleFailure(result, this.logger);
      },
    );
  }
}
