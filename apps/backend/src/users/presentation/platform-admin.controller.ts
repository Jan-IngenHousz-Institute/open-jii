import { Controller, Logger, Req } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";

import { platformAdminContract } from "@repo/api/domains/user/platform-admin.contract";

import {
  isApiKeyRequest,
  RequiresPlatformRole,
} from "../../authorization/requires-platform-role.guard";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { GetPlatformAdminAccessUseCase } from "../application/use-cases/get-platform-admin-access/get-platform-admin-access";
import { ListPlatformAdminsUseCase } from "../application/use-cases/list-platform-admins/list-platform-admins";

@Controller()
export class PlatformAdminController {
  private readonly logger = new Logger(PlatformAdminController.name);
  constructor(
    private readonly getAccess: GetPlatformAdminAccessUseCase,
    private readonly listAdmins: ListPlatformAdminsUseCase,
  ) {}

  @Implement(platformAdminContract.getPlatformAdminAccess)
  access(@Session() session: UserSession, @Req() request: Request) {
    return implement(platformAdminContract.getPlatformAdminAccess).handler(async () => {
      const result = await this.getAccess.execute(session.user.id, isApiKeyRequest(request));
      return result.isSuccess() ? result.value : throwOrpcFailure(result, this.logger);
    });
  }

  @RequiresPlatformRole("platform_admin")
  @Implement(platformAdminContract.listPlatformAdmins)
  list() {
    return implement(platformAdminContract.listPlatformAdmins).handler(async () => {
      const result = await this.listAdmins.execute();
      return result.isSuccess() ? result.value : throwOrpcFailure(result, this.logger);
    });
  }
}
