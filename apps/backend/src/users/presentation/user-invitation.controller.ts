import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { userContract } from "@repo/api/domains/user/user.contract";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { CreateInvitationUseCase } from "../application/use-cases/create-invitation/create-invitation";
import { GetInvitationsUseCase } from "../application/use-cases/get-invitations/get-invitations";
import { RevokeInvitationUseCase } from "../application/use-cases/revoke-invitation/revoke-invitation";

@Controller()
export class InvitationController {
  private readonly logger = new Logger(InvitationController.name);

  constructor(
    private readonly createInvitationUseCase: CreateInvitationUseCase,
    private readonly getInvitationsUseCase: GetInvitationsUseCase,
    private readonly revokeInvitationUseCase: RevokeInvitationUseCase,
  ) {}

  @Implement(userContract.createInvitation)
  createInvitation(@Session() session: UserSession) {
    return implement(userContract.createInvitation).handler(async ({ input }) => {
      const result = await this.createInvitationUseCase.execute(
        input.resourceType as "experiment",
        input.resourceId,
        input.email,
        { tier: input.tier },
        session.user.id,
      );
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(userContract.listInvitations)
  listInvitations(@Session() session: UserSession) {
    return implement(userContract.listInvitations).handler(async ({ input }) => {
      const result = await this.getInvitationsUseCase.execute(
        input.resourceType as "experiment",
        input.resourceId,
        session.user.id,
      );
      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(userContract.revokeInvitation)
  revokeInvitation(@Session() session: UserSession) {
    return implement(userContract.revokeInvitation).handler(async ({ input }) => {
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
