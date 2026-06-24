import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentMembersOrpcContract } from "@repo/api/domains/experiment/experiment-members.orpc";

import { formatDatesList } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { AddExperimentMembersUseCase } from "../application/use-cases/experiment-members/add-experiment-members";
import { ListExperimentMembersUseCase } from "../application/use-cases/experiment-members/list-experiment-members";
import { RemoveExperimentMemberUseCase } from "../application/use-cases/experiment-members/remove-experiment-member";
import { TransferExperimentAdminUseCase } from "../application/use-cases/experiment-members/transfer-experiment-admin";
import { UpdateExperimentMemberRoleUseCase } from "../application/use-cases/experiment-members/update-experiment-member-role";

@Controller()
export class ExperimentMembersOrpcController {
  private readonly logger = new Logger(ExperimentMembersOrpcController.name);

  constructor(
    private readonly listExperimentMembersUseCase: ListExperimentMembersUseCase,
    private readonly addExperimentMembersUseCase: AddExperimentMembersUseCase,
    private readonly removeExperimentMemberUseCase: RemoveExperimentMemberUseCase,
    private readonly updateExperimentMemberRoleUseCase: UpdateExperimentMemberRoleUseCase,
    private readonly transferExperimentAdminUseCase: TransferExperimentAdminUseCase,
  ) {}

  @Implement(experimentMembersOrpcContract.listExperimentMembers)
  listMembers(@Session() session: UserSession) {
    return implement(experimentMembersOrpcContract.listExperimentMembers).handler(
      async ({ input }) => {
        const result = await this.listExperimentMembersUseCase.execute(input.id, session.user.id);
        if (result.isSuccess()) {
          return formatDatesList(result.value);
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentMembersOrpcContract.addExperimentMembers)
  addMembers(@Session() session: UserSession) {
    return implement(experimentMembersOrpcContract.addExperimentMembers).handler(
      async ({ input }) => {
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
      },
    );
  }

  @Implement(experimentMembersOrpcContract.removeExperimentMember)
  removeMember(@Session() session: UserSession) {
    return implement(experimentMembersOrpcContract.removeExperimentMember).handler(
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

  @Implement(experimentMembersOrpcContract.updateExperimentMemberRole)
  updateMemberRole(@Session() session: UserSession) {
    return implement(experimentMembersOrpcContract.updateExperimentMemberRole).handler(
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

  @Implement(experimentMembersOrpcContract.transferExperimentAdmin)
  transferAdmin(@Session() session: UserSession) {
    return implement(experimentMembersOrpcContract.transferExperimentAdmin).handler(
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
