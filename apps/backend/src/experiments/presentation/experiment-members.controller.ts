import { Controller, Logger } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { AddExperimentMemberUseCase } from "../application/use-cases/experiment-members/add-experiment-member";
import { ListExperimentMembersUseCase } from "../application/use-cases/experiment-members/list-experiment-members";
import { RemoveExperimentMemberUseCase } from "../application/use-cases/experiment-members/remove-experiment-member";
import { handleApiError } from "../utils/error-handling";

@Controller()
export class ExperimentMembersController {
  private readonly logger = new Logger(ExperimentMembersController.name);

  constructor(
    private readonly listExperimentMembersUseCase: ListExperimentMembersUseCase,
    private readonly addExperimentMemberUseCase: AddExperimentMemberUseCase,
    private readonly removeExperimentMemberUseCase: RemoveExperimentMemberUseCase,
  ) {}

  @TsRestHandler(contract.listExperimentMembers)
  async listMembers() {
    return tsRestHandler(
      contract.listExperimentMembers,
      async ({ params, query }) => {
        try {
          const userId = query.userId || "default-user-id";
          const members = await this.listExperimentMembersUseCase.execute(
            params.id,
            userId,
          );

          return {
            status: StatusCodes.OK as const,
            body: members,
          };
        } catch (error) {
          return handleApiError(error, this.logger);
        }
      },
    );
  }

  @TsRestHandler(contract.addExperimentMember)
  async addMember() {
    return tsRestHandler(
      contract.addExperimentMember,
      async ({ params, body, query }) => {
        try {
          const userId = query.userId || "default-user-id";
          const member = await this.addExperimentMemberUseCase.execute(
            params.id,
            body,
            userId,
          );

          this.logger.log(
            `Member ${body.userId} added to experiment ${params.id} by user ${userId}`,
          );
          return {
            status: StatusCodes.CREATED as const,
            body: member,
          };
        } catch (error) {
          return handleApiError(error, this.logger);
        }
      },
    );
  }

  @TsRestHandler(contract.removeExperimentMember)
  async removeMember() {
    return tsRestHandler(
      contract.removeExperimentMember,
      async ({ params, query }) => {
        try {
          const userId = query.userId || "default-user-id";
          await this.removeExperimentMemberUseCase.execute(
            params.id,
            params.memberId,
            userId,
          );

          this.logger.log(
            `Member ${params.memberId} removed from experiment ${params.id} by user ${userId}`,
          );
          return {
            status: 204,
            body: null,
          };
        } catch (error) {
          return handleApiError(error, this.logger);
        }
      },
    );
  }
}
