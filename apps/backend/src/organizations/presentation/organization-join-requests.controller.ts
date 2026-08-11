import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { organizationJoinRequestsContract } from "@repo/api/domains/organization/join-requests/organization-join-requests.contract";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { CancelMyOrganizationJoinRequestUseCase } from "../application/use-cases/join-requests/cancel-my-organization-join-request";
import { DecideOrganizationJoinRequestUseCase } from "../application/use-cases/join-requests/decide-organization-join-request";
import { ListOrganizationJoinRequestsUseCase } from "../application/use-cases/join-requests/list-organization-join-requests";
import { RequestJoinOrganizationUseCase } from "../application/use-cases/join-requests/request-join-organization";

@Controller()
export class OrganizationJoinRequestsController {
  private readonly logger = new Logger(OrganizationJoinRequestsController.name);

  constructor(
    private readonly requestJoinOrganizationUseCase: RequestJoinOrganizationUseCase,
    private readonly listOrganizationJoinRequestsUseCase: ListOrganizationJoinRequestsUseCase,
    private readonly cancelMyOrganizationJoinRequestUseCase: CancelMyOrganizationJoinRequestUseCase,
    private readonly decideOrganizationJoinRequestUseCase: DecideOrganizationJoinRequestUseCase,
  ) {}

  @Implement(organizationJoinRequestsContract.createOrganizationJoinRequest)
  createOrganizationJoinRequest(@Session() session: UserSession) {
    return implement(organizationJoinRequestsContract.createOrganizationJoinRequest).handler(
      async ({ input }) => {
        const result = await this.requestJoinOrganizationUseCase.execute(
          input.id,
          session.user.id,
          input.message,
        );

        if (result.isSuccess()) {
          return formatDates(result.value.joinRequest);
        }

        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(organizationJoinRequestsContract.listOrganizationJoinRequests)
  listOrganizationJoinRequests(@Session() session: UserSession) {
    return implement(organizationJoinRequestsContract.listOrganizationJoinRequests).handler(
      async ({ input }) => {
        const result = await this.listOrganizationJoinRequestsUseCase.execute(
          input.id,
          session.user.id,
        );

        if (result.isSuccess()) {
          return formatDatesList(result.value);
        }

        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(organizationJoinRequestsContract.cancelMyOrganizationJoinRequest)
  cancelMyOrganizationJoinRequest(@Session() session: UserSession) {
    return implement(organizationJoinRequestsContract.cancelMyOrganizationJoinRequest).handler(
      async ({ input }) => {
        const result = await this.cancelMyOrganizationJoinRequestUseCase.execute(
          input.id,
          session.user.id,
        );

        if (result.isSuccess()) {
          return undefined;
        }

        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(organizationJoinRequestsContract.decideOrganizationJoinRequest)
  decideOrganizationJoinRequest(@Session() session: UserSession) {
    return implement(organizationJoinRequestsContract.decideOrganizationJoinRequest).handler(
      async ({ input }) => {
        const result = await this.decideOrganizationJoinRequestUseCase.execute(
          input.id,
          input.requestId,
          input.decision,
          session.user.id,
        );

        if (result.isSuccess()) {
          return formatDates(result.value);
        }

        return throwOrpcFailure(result, this.logger);
      },
    );
  }
}
