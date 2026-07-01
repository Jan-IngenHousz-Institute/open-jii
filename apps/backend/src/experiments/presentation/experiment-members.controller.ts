import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentMembersContract } from "@repo/api/domains/experiment/experiment-members.contract";

import { formatDatesList } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { AddExperimentMembersUseCase } from "../application/use-cases/experiment-members/add-experiment-members";
import { ListExperimentMembersUseCase } from "../application/use-cases/experiment-members/list-experiment-members";
import { RemoveExperimentMemberUseCase } from "../application/use-cases/experiment-members/remove-experiment-member";
import { TransferExperimentAdminUseCase } from "../application/use-cases/experiment-members/transfer-experiment-admin";
import { UpdateExperimentMemberRoleUseCase } from "../application/use-cases/experiment-members/update-experiment-member-role";

@Controller()
export class ExperimentMembersController {
  private readonly logger = new Logger(ExperimentMembersController.name);

  constructor(
    private readonly listExperimentMembersUseCase: ListExperimentMembersUseCase,
    private readonly addExperimentMembersUseCase: AddExperimentMembersUseCase,
    private readonly removeExperimentMemberUseCase: RemoveExperimentMemberUseCase,
    private readonly updateExperimentMemberRoleUseCase: UpdateExperimentMemberRoleUseCase,
    private readonly transferExperimentAdminUseCase: TransferExperimentAdminUseCase,
  ) {}

  @Implement(experimentMembersContract.listExperimentMembers)
  listMembers(@Session() session: UserSession) {
    return implement(experimentMembersContract.listExperimentMembers).handler(async ({ input }) => {
      const result = await this.listExperimentMembersUseCase.execute(input.id, session.user.id);
      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentMembersContract.addExperimentMembers)
  addMembers(@Session() session: UserSession) {
    return implement(experimentMembersContract.addExperimentMembers).handler(async ({ input }) => {
      const { id, ...body } = input;
      const result = await this.addExperimentMembersUseCase.execute(
        id,
        body.members,
        session.user.id,
      );
      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentMembersContract.removeExperimentMember)
  removeMember(@Session() session: UserSession) {
    return implement(experimentMembersContract.removeExperimentMember).handler(
      async ({ input }) => {
        const result = await this.removeExperimentMemberUseCase.execute(
          input.id,
          input.memberId,
          session.user.id,
        );
        if (result.isSuccess()) {
          return undefined;
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentMembersContract.updateExperimentMemberRole)
  updateMemberRole(@Session() session: UserSession) {
    return implement(experimentMembersContract.updateExperimentMemberRole).handler(
      async ({ input }) => {
        const { id, memberId, ...body } = input;
        const result = await this.updateExperimentMemberRoleUseCase.execute(
          id,
          memberId,
          body.role,
          session.user.id,
        );
        if (result.isSuccess()) {
          return formatDatesList([result.value])[0];
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentMembersContract.transferExperimentAdmin)
  transferAdmin(@Session() session: UserSession) {
    return implement(experimentMembersContract.transferExperimentAdmin).handler(
      async ({ input }) => {
        const result = await this.transferExperimentAdminUseCase.execute(
          input.transfers,
          session.user.id,
        );
        if (result.isSuccess()) {
          return { results: result.value };
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }
}
