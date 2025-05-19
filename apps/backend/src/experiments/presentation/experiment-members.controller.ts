import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { SessionUser } from "@repo/auth/config";

import { CurrentUser } from "../../common/decorators";
import { AuthGuard } from "../../common/guards";
import { AddExperimentMemberUseCase } from "../application/use-cases/experiment-members/add-experiment-member";
import { ListExperimentMembersUseCase } from "../application/use-cases/experiment-members/list-experiment-members";
import { RemoveExperimentMemberUseCase } from "../application/use-cases/experiment-members/remove-experiment-member";
import { handleResult, Success } from "../utils/fp-utils";

@Controller()
@UseGuards(AuthGuard)
export class ExperimentMembersController {
  private readonly logger = new Logger(ExperimentMembersController.name);

  constructor(
    private readonly listExperimentMembersUseCase: ListExperimentMembersUseCase,
    private readonly addExperimentMemberUseCase: AddExperimentMemberUseCase,
    private readonly removeExperimentMemberUseCase: RemoveExperimentMemberUseCase,
  ) {}

  @TsRestHandler(contract.experiments.listExperimentMembers)
  async listMembers(@CurrentUser() user: SessionUser) {
    return tsRestHandler(
      contract.experiments.listExperimentMembers,
      async ({ params }) => {
        const result = await this.listExperimentMembersUseCase.execute(
          params.id,
          user.id,
        );

        if (result.isSuccess()) {
          // Format dates to strings for the API contract
          const members = (result as Success<any>).value;
          const formattedMembers = members.map((member) => ({
            ...member,
            joinedAt: member.joinedAt.toISOString(),
          }));

          return {
            status: StatusCodes.OK as const,
            body: formattedMembers,
          };
        }

        return handleResult(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.addExperimentMember)
  async addMember(@CurrentUser() user: SessionUser) {
    return tsRestHandler(
      contract.experiments.addExperimentMember,
      async ({ params, body }) => {
        const result = await this.addExperimentMemberUseCase.execute(
          params.id,
          body,
          user.id,
        );

        if (result.isSuccess()) {
          const member = (result as Success<any>).value;
          // Format date to string for the API contract
          const formattedMember = {
            ...member,
            joinedAt: member.joinedAt.toISOString(),
          };

          this.logger.log(
            `Member ${body.userId} added to experiment ${params.id} by user ${user.id}`,
          );

          return {
            status: StatusCodes.CREATED as const,
            body: formattedMember,
          };
        }

        return handleResult(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.removeExperimentMember)
  async removeMember(@CurrentUser() user: SessionUser) {
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

        return handleResult(result, this.logger);
      },
    );
  }
}
