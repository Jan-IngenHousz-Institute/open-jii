import { Controller, Logger } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { AddExperimentMemberUseCase } from "../application/use-cases/experiment-members/add-experiment-member";
import { ListExperimentMembersUseCase } from "../application/use-cases/experiment-members/list-experiment-members";
import { RemoveExperimentMemberUseCase } from "../application/use-cases/experiment-members/remove-experiment-member";
import { handleResult, Success } from "../utils/fp-utils";

@Controller()
export class ExperimentMembersController {
  private readonly logger = new Logger(ExperimentMembersController.name);

  constructor(
    private readonly listExperimentMembersUseCase: ListExperimentMembersUseCase,
    private readonly addExperimentMemberUseCase: AddExperimentMemberUseCase,
    private readonly removeExperimentMemberUseCase: RemoveExperimentMemberUseCase,
  ) {}

  @TsRestHandler(contract.experiments.listExperimentMembers)
  async listMembers() {
    return tsRestHandler(
      contract.experiments.listExperimentMembers,
      async ({ params, query }) => {
        const result = await this.listExperimentMembersUseCase.execute(
          params.id,
          query.userId,
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
  async addMember() {
    return tsRestHandler(
      contract.experiments.addExperimentMember,
      async ({ params, body, query }) => {
        const result = await this.addExperimentMemberUseCase.execute(
          params.id,
          body,
          query.userId,
        );

        if (result.isSuccess()) {
          const member = (result as Success<any>).value;
          // Format date to string for the API contract
          const formattedMember = {
            ...member,
            joinedAt: member.joinedAt.toISOString(),
          };

          this.logger.log(
            `Member ${body.userId} added to experiment ${params.id} by user ${query.userId}`,
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
  async removeMember() {
    return tsRestHandler(
      contract.experiments.removeExperimentMember,
      async ({ params, query }) => {
        const result = await this.removeExperimentMemberUseCase.execute(
          params.id,
          params.memberId,
          query.userId,
        );

        if (result.isSuccess()) {
          this.logger.log(
            `Member ${params.memberId} removed from experiment ${params.id} by user ${query.userId}`,
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
