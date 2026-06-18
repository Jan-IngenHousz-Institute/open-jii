import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { formatDates, formatDatesList } from "../common/utils/date-formatter";
import { handleFailure } from "../common/utils/fp-utils";
import { CreateResourceGrantUseCase } from "./use-cases/create-resource-grant";
import { GetResourceAccessUseCase } from "./use-cases/get-resource-access";
import { ListResourceGrantsUseCase } from "./use-cases/list-resource-grants";
import { RevokeResourceGrantUseCase } from "./use-cases/revoke-resource-grant";

@Controller()
export class SharingController {
  private readonly logger = new Logger(SharingController.name);

  constructor(
    private readonly listGrants: ListResourceGrantsUseCase,
    private readonly createGrant: CreateResourceGrantUseCase,
    private readonly revokeGrant: RevokeResourceGrantUseCase,
    private readonly getAccess: GetResourceAccessUseCase,
  ) {}

  @TsRestHandler(contract.sharing.getResourceAccess)
  access(@Session() session: UserSession) {
    return tsRestHandler(contract.sharing.getResourceAccess, async ({ params }) => {
      const body = await this.getAccess.execute(
        session.user.id,
        params.resourceType,
        params.resourceId,
      );
      return { status: StatusCodes.OK as const, body };
    });
  }

  @TsRestHandler(contract.sharing.listResourceGrants)
  list(@Session() session: UserSession) {
    return tsRestHandler(contract.sharing.listResourceGrants, async ({ params }) => {
      const result = await this.listGrants.execute(
        session.user.id,
        params.resourceType,
        params.resourceId,
      );
      if (result.isSuccess()) {
        return { status: StatusCodes.OK as const, body: formatDatesList(result.value) };
      }
      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.sharing.createResourceGrant)
  create(@Session() session: UserSession) {
    return tsRestHandler(contract.sharing.createResourceGrant, async ({ params, body }) => {
      const result = await this.createGrant.execute(
        session.user.id,
        params.resourceType,
        params.resourceId,
        body,
      );
      if (result.isSuccess()) {
        return { status: StatusCodes.CREATED as const, body: formatDates(result.value) };
      }
      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.sharing.revokeResourceGrant)
  revoke(@Session() session: UserSession) {
    return tsRestHandler(contract.sharing.revokeResourceGrant, async ({ params }) => {
      const result = await this.revokeGrant.execute(
        session.user.id,
        params.resourceType,
        params.resourceId,
        params.grantId,
      );
      if (result.isSuccess()) {
        return { status: StatusCodes.OK as const, body: result.value };
      }
      return handleFailure(result, this.logger);
    });
  }
}
