import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { sharingContract } from "@repo/api/domains/sharing/sharing.contract";

import { formatDatesList } from "../common/utils/date-formatter";
import { throwOrpcFailure } from "../common/utils/orpc-fp";
import { CreateGrantUseCase } from "./use-cases/create-grant";
import { LeaveResourceUseCase } from "./use-cases/leave-resource";
import { ListGrantsUseCase } from "./use-cases/list-grants";
import { RevokeGrantUseCase } from "./use-cases/revoke-grant";
import { SearchGranteeOrganizationsUseCase } from "./use-cases/search-grantee-organizations";
import { UpdateGrantUseCase } from "./use-cases/update-grant";

/**
 * Generic per-resource sharing (collaborators). Every operation authorizes with
 * `can(share)` inside its use-case — no `@CanAccess` guard, since the resource type
 * is a runtime path value — and acts only on direct grants.
 */
@Controller()
export class SharingController {
  private readonly logger = new Logger(SharingController.name);

  constructor(
    private readonly listGrantsUseCase: ListGrantsUseCase,
    private readonly createGrantUseCase: CreateGrantUseCase,
    private readonly updateGrantUseCase: UpdateGrantUseCase,
    private readonly leaveResourceUseCase: LeaveResourceUseCase,
    private readonly revokeGrantUseCase: RevokeGrantUseCase,
    private readonly searchGranteeOrganizationsUseCase: SearchGranteeOrganizationsUseCase,
  ) {}

  @Implement(sharingContract.listGrants)
  listGrants(@Session() session: UserSession) {
    return implement(sharingContract.listGrants).handler(async ({ input }) => {
      const result = await this.listGrantsUseCase.execute(
        session.user.id,
        input.resourceType,
        input.id,
      );
      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(sharingContract.createGrant)
  createGrant(@Session() session: UserSession) {
    return implement(sharingContract.createGrant).handler(async ({ input }) => {
      const { resourceType, id, ...body } = input;
      const result = await this.createGrantUseCase.execute(session.user.id, resourceType, id, body);
      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(sharingContract.updateGrant)
  updateGrant(@Session() session: UserSession) {
    return implement(sharingContract.updateGrant).handler(async ({ input }) => {
      const { resourceType, id, grantId, ...body } = input;
      const result = await this.updateGrantUseCase.execute(
        session.user.id,
        resourceType,
        id,
        grantId,
        body,
      );
      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  /**
   * Self-leave. Must stay declared before `revokeGrant`: both are DELETEs under
   * `/collaborators/…` and routes match in declaration order, so `me` has to be
   * taken literally here before `{grantId}` can swallow it (where it would fail
   * uuid validation). Authorized by the caller's own grant, not `can(share)` —
   * see the use-case.
   */
  @Implement(sharingContract.leaveResource)
  leaveResource(@Session() session: UserSession) {
    return implement(sharingContract.leaveResource).handler(async ({ input }) => {
      const result = await this.leaveResourceUseCase.execute(
        session.user.id,
        input.resourceType,
        input.id,
      );
      if (result.isSuccess()) {
        return undefined;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(sharingContract.revokeGrant)
  revokeGrant(@Session() session: UserSession) {
    return implement(sharingContract.revokeGrant).handler(async ({ input }) => {
      const result = await this.revokeGrantUseCase.execute(
        session.user.id,
        input.resourceType,
        input.id,
        input.grantId,
      );
      if (result.isSuccess()) {
        return undefined;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  /**
   * Organization lookup for the grantee picker. Read-scoped to the caller's own
   * memberships (see the use-case), so it needs no per-resource authorization.
   */
  @Implement(sharingContract.searchGranteeOrganizations)
  searchGranteeOrganizations(@Session() session: UserSession) {
    return implement(sharingContract.searchGranteeOrganizations).handler(async ({ input }) => {
      const result = await this.searchGranteeOrganizationsUseCase.execute(session.user.id, {
        query: input.query,
        limit: input.limit,
      });
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
