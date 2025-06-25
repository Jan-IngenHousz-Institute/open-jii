import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { SessionUser } from "@repo/auth/config";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { AddExperimentMembersUseCase } from "../application/use-cases/experiment-members/add-experiment-members";
import { ListExperimentMembersUseCase } from "../application/use-cases/experiment-members/list-experiment-members";
import { RemoveExperimentMemberUseCase } from "../application/use-cases/experiment-members/remove-experiment-member";

@Controller()
@UseGuards(AuthGuard)
export class ExperimentMembersController {
  private readonly logger = new Logger(ExperimentMembersController.name);

  constructor(
    private readonly listExperimentMembersUseCase: ListExperimentMembersUseCase,
    private readonly addExperimentMembersUseCase: AddExperimentMembersUseCase,
    private readonly removeExperimentMemberUseCase: RemoveExperimentMemberUseCase,
  ) {}

  @TsRestHandler(contract.experiments.listExperimentMembers)
  listMembers(@CurrentUser() user: SessionUser) {
    return tsRestHandler(contract.experiments.listExperimentMembers, async ({ params }) => {
      const result = await this.listExperimentMembersUseCase.execute(params.id, user.id);

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
    });
  }

  @TsRestHandler(contract.experiments.addExperimentMembers)
  addMembers(@CurrentUser() user: SessionUser) {
    return tsRestHandler(contract.experiments.addExperimentMembers, async ({ params, body }) => {
      const result = await this.addExperimentMembersUseCase.execute(
        params.id,
        body.members,
        user.id,
      );

      if (result.isSuccess()) {
        const members = result.value;
        const formattedMembers = formatDatesList(members);

        this.logger.log(
          `Members [${body.members.map((m) => m.userId).join(", ")}] added to experiment ${params.id} by user ${user.id}`,
        );

        return {
          status: StatusCodes.CREATED,
          body: formattedMembers,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.removeExperimentMember)
  removeMember(@CurrentUser() user: SessionUser) {
    return tsRestHandler(contract.experiments.removeExperimentMember, async ({ params }) => {
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
    });
  }
}
