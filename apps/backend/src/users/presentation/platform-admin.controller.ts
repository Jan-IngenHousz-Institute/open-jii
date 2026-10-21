import { Controller, Logger, Req } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";

import { platformAdminContract } from "@repo/api/domains/user/platform-admin.contract";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { GetPlatformAdminAccessUseCase } from "../application/use-cases/get-platform-admin-access/get-platform-admin-access";
import { ListPlatformAdminsUseCase } from "../application/use-cases/list-platform-admins/list-platform-admins";
import { SearchPlatformAdminCandidatesUseCase } from "../application/use-cases/search-platform-admin-candidates/search-platform-admin-candidates";

@Controller()
export class PlatformAdminController {
  private readonly logger = new Logger(PlatformAdminController.name);
  constructor(
    private readonly getAccess: GetPlatformAdminAccessUseCase,
    private readonly listAdmins: ListPlatformAdminsUseCase,
    private readonly searchCandidates: SearchPlatformAdminCandidatesUseCase,
  ) {}

  private headers(request: Request): Headers {
    const headers = new Headers();
    if (request.headers["x-api-key"] !== undefined) headers.set("x-api-key", "present");
    return headers;
  }

  @Implement(platformAdminContract.getPlatformAdminAccess)
  access(@Session() session: UserSession, @Req() request: Request) {
    return implement(platformAdminContract.getPlatformAdminAccess).handler(async () => {
      const result = await this.getAccess.execute(session.user, this.headers(request));
      return result.isSuccess() ? result.value : throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(platformAdminContract.listPlatformAdmins)
  list(@Session() session: UserSession, @Req() request: Request) {
    return implement(platformAdminContract.listPlatformAdmins).handler(async () => {
      const result = await this.listAdmins.execute(session.user, this.headers(request));
      return result.isSuccess() ? result.value : throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(platformAdminContract.searchPlatformAdminCandidates)
  search(@Session() session: UserSession, @Req() request: Request) {
    return implement(platformAdminContract.searchPlatformAdminCandidates).handler(
      async ({ input }) => {
        const result = await this.searchCandidates.execute(
          session.user,
          this.headers(request),
          input.search,
        );
        return result.isSuccess() ? result.value : throwOrpcFailure(result, this.logger);
      },
    );
  }
}
