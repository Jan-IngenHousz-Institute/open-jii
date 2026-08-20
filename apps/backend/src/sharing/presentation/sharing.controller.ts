import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { sharingContract } from "@repo/api/domains/sharing/sharing.contract";
import { sharingTransferAdminContract } from "@repo/api/domains/sharing/transfer-admin/sharing-transfer-admin.contract";
import { sharingTransferOrgContract } from "@repo/api/domains/sharing/transfer-org/sharing-transfer-org.contract";

import { formatDatesList } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { CreateGrantUseCase } from "../application/use-cases/create-grant/create-grant";
import { LeaveResourceUseCase } from "../application/use-cases/leave-resource/leave-resource";
import { ListGrantsUseCase } from "../application/use-cases/list-grants/list-grants";
import { RevokeGrantUseCase } from "../application/use-cases/revoke-grant/revoke-grant";
import { SearchGranteeOrganizationsUseCase } from "../application/use-cases/search-grantee-organizations/search-grantee-organizations";
import { SearchGranteeUsersUseCase } from "../application/use-cases/search-grantee-users/search-grantee-users";
import { TransferResourceAdminUseCase } from "../application/use-cases/transfer-resource-admin/transfer-resource-admin";
import { TransferResourceOrgUseCase } from "../application/use-cases/transfer-resource-org/transfer-resource-org";
import { UpdateGrantUseCase } from "../application/use-cases/update-grant/update-grant";

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
    private readonly transferResourceAdminUseCase: TransferResourceAdminUseCase,
    private readonly transferResourceOrgUseCase: TransferResourceOrgUseCase,
    private readonly searchGranteeOrganizationsUseCase: SearchGranteeOrganizationsUseCase,
    private readonly searchGranteeUsersUseCase: SearchGranteeUsersUseCase,
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
   * Self-leave, authorized by the caller's own grant rather than `can(share)` — see
   * the use-case. Must stay declared before `revokeGrant`: both are DELETEs under
   * `/collaborators/…` and routes match in declaration order, so `me` has to be
   * taken literally before `{grantId}` swallows it.
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
   * Bulk admin hand-off, used to clear account-deletion blockers. One request spans
   * several resources of several types, so there is no route-level `@CanAccess` —
   * authorization is per-transfer inside the use case.
   */
  @Implement(sharingTransferAdminContract.transferResourceAdmin)
  transferResourceAdmin(@Session() session: UserSession) {
    return implement(sharingTransferAdminContract.transferResourceAdmin).handler(
      async ({ input }) => {
        const result = await this.transferResourceAdminUseCase.execute(
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

  /**
   * Move a resource to another organization. No `@CanAccess` guard for the same
   * reason as the rest of this controller — the resource type is a runtime path
   * value — and the gate is more than access anyway: see the use-case.
   */
  @Implement(sharingTransferOrgContract.transferResourceOrganization)
  transferResourceOrganization(@Session() session: UserSession) {
    return implement(sharingTransferOrgContract.transferResourceOrganization).handler(
      async ({ input }) => {
        const result = await this.transferResourceOrgUseCase.execute(
          session.user.id,
          input.resourceType,
          input.id,
          input.targetOrganizationId,
        );
        if (result.isSuccess()) {
          return result.value;
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
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

  /**
   * User lookup for the grantee picker, annotated with the access each candidate
   * already holds here — so `can(share)` inside the use-case, not mere sign-in.
   */
  @Implement(sharingContract.searchGranteeUsers)
  searchGranteeUsers(@Session() session: UserSession) {
    return implement(sharingContract.searchGranteeUsers).handler(async ({ input }) => {
      const result = await this.searchGranteeUsersUseCase.execute(
        session.user.id,
        input.resourceType,
        input.id,
        { query: input.query, limit: input.limit },
      );
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
