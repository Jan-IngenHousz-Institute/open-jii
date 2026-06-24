import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { userOrpcContract } from "@repo/api/domains/user/user.orpc";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { CreateInvitationUseCase } from "../application/use-cases/create-invitation/create-invitation";
import { GetInvitationsUseCase } from "../application/use-cases/get-invitations/get-invitations";
import { RevokeInvitationUseCase } from "../application/use-cases/revoke-invitation/revoke-invitation";
import { UpdateInvitationRoleUseCase } from "../application/use-cases/update-invitation-role/update-invitation-role";

@Controller()
export class InvitationOrpcController {
  private readonly logger = new Logger(InvitationOrpcController.name);

  constructor(
    private readonly createInvitationUseCase: CreateInvitationUseCase,
    private readonly getInvitationsUseCase: GetInvitationsUseCase,
    private readonly revokeInvitationUseCase: RevokeInvitationUseCase,
    private readonly updateInvitationRoleUseCase: UpdateInvitationRoleUseCase,
  ) {}

  @Implement(userOrpcContract.createInvitation)
  createInvitation(@Session() session: UserSession) {
    return implement(userOrpcContract.createInvitation).handler(async ({ input }) => {
      const result = await this.createInvitationUseCase.execute(
        input.resourceType as "experiment",
        input.resourceId,
        input.email,
        input.role,
        session.user.id,
      );
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(userOrpcContract.listInvitations)
  listInvitations() {
    return implement(userOrpcContract.listInvitations).handler(async ({ input }) => {
      const result = await this.getInvitationsUseCase.execute(
        input.resourceType as "experiment",
        input.resourceId,
      );
      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(userOrpcContract.updateInvitationRole)
  updateInvitationRole(@Session() session: UserSession) {
    return implement(userOrpcContract.updateInvitationRole).handler(async ({ input }) => {
      const result = await this.updateInvitationRoleUseCase.execute(
        input.invitationId,
        input.role,
        session.user.id,
      );
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(userOrpcContract.revokeInvitation)
  revokeInvitation(@Session() session: UserSession) {
    return implement(userOrpcContract.revokeInvitation).handler(async ({ input }) => {
      const result = await this.revokeInvitationUseCase.execute(
        input.invitationId,
        session.user.id,
      );
      if (result.isSuccess()) {
        return undefined;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
