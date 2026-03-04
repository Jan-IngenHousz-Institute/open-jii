import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { CreateInvitationUseCase } from "../application/use-cases/create-invitation/create-invitation";
import { GetInvitationsUseCase } from "../application/use-cases/get-invitations/get-invitations";
import { RevokeInvitationUseCase } from "../application/use-cases/revoke-invitation/revoke-invitation";
import { UpdateInvitationRoleUseCase } from "../application/use-cases/update-invitation-role/update-invitation-role";

@Controller()
export class InvitationController {
  private readonly logger = new Logger(InvitationController.name);

  constructor(
    private readonly createInvitationUseCase: CreateInvitationUseCase,
    private readonly getInvitationsUseCase: GetInvitationsUseCase,
    private readonly revokeInvitationUseCase: RevokeInvitationUseCase,
    private readonly updateInvitationRoleUseCase: UpdateInvitationRoleUseCase,
  ) {}

  @TsRestHandler(contract.users.createInvitation)
  createInvitation(@Session() session: UserSession) {
    return tsRestHandler(contract.users.createInvitation, async ({ body }) => {
      const result = await this.createInvitationUseCase.execute(
        body.resourceType as "experiment",
        body.resourceId,
        body.email,
        body.role,
        session.user.id,
      );

      if (result.isSuccess()) {
        return {
          status: StatusCodes.CREATED as 201,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.users.listInvitations)
  listInvitations(@Session() _session: UserSession) {
    return tsRestHandler(contract.users.listInvitations, async ({ query }) => {
      const result = await this.getInvitationsUseCase.execute(
        query.resourceType as "experiment",
        query.resourceId,
      );

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK as 200,
          body: formatDatesList(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.users.updateInvitationRole)
  updateInvitationRole(@Session() session: UserSession) {
    return tsRestHandler(contract.users.updateInvitationRole, async ({ params, body }) => {
      const result = await this.updateInvitationRoleUseCase.execute(
        params.invitationId,
        body.role,
        session.user.id,
      );

      if (result.isSuccess()) {
        this.logger.log(
          `Invitation ${params.invitationId} role updated to ${body.role} by user ${session.user.id}`,
        );

        return {
          status: StatusCodes.OK as 200,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.users.revokeInvitation)
  revokeInvitation(@Session() session: UserSession) {
    return tsRestHandler(contract.users.revokeInvitation, async ({ params }) => {
      const result = await this.revokeInvitationUseCase.execute(
        params.invitationId,
        session.user.id,
      );

      if (result.isSuccess()) {
        this.logger.log(`Invitation ${params.invitationId} revoked by user ${session.user.id}`);

        return {
          status: StatusCodes.NO_CONTENT as 204,
          body: null,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
