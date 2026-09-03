import { Injectable, Logger } from "@nestjs/common";

import type {
  TransferResourceResponse,
  TransferableResourceType,
} from "@repo/api/domains/sharing/transfer-org/sharing-transfer-org.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import {
  NOT_A_TARGET_MEMBER_MESSAGE,
  SharingRepository,
  TRANSFER_NOT_ALLOWED_MESSAGE,
} from "../../../core/repositories/sharing.repository";

/**
 * Move a resource from the organization that owns it to another one.
 *
 * Two things have to be true, and the second is the one that matters: the caller
 * must have full control of the resource (`can(manage)`), **and** authority over
 * the organization losing it — owner or admin there, or, on a resource whose
 * organization has no living owner left, whatever grant still gives them control.
 * Without that second half any "Can edit" collaborator could walk off with
 * somebody else's work into their own workspace, and revoking a grant is
 * `share`-gated, so the organization would have no way back in.
 *
 * The target is any organization the caller belongs to, their own personal
 * workspace included. There is no acceptance step on that side: members may
 * already create resources there, and a transfer in is the same act.
 */
@Injectable()
export class TransferResourceOrgUseCase {
  private readonly logger = new Logger(TransferResourceOrgUseCase.name);

  constructor(
    private readonly authz: AuthorizationService,
    private readonly repo: SharingRepository,
  ) {}

  async execute(
    userId: string,
    resourceType: TransferableResourceType,
    resourceId: string,
    targetOrganizationId: string,
  ): Promise<Result<TransferResourceResponse>> {
    const decision = await this.authz.can(userId, { resourceType, resourceId, action: "manage" });
    if (!decision.allow) {
      return failure(
        decision.reason === "not-found"
          ? AppError.notFound("Resource not found")
          : AppError.forbidden("You cannot transfer this resource"),
      );
    }

    // The organization the decision was resolved against, never a second read:
    // between the two the resource could have moved, and the transfer would then
    // be authorized against an owner it no longer has.
    const sourceOrganizationId = decision.organizationId;
    if (sourceOrganizationId === targetOrganizationId) {
      return failure(AppError.badRequest("This resource already belongs to that organization"));
    }

    if (!(await this.authz.canTransferOut(userId, sourceOrganizationId))) {
      return failure(AppError.forbidden(TRANSFER_NOT_ALLOWED_MESSAGE));
    }

    // Membership, not a role: a member can create resources in the organization,
    // so they can bring one in. Their own personal workspace qualifies — it is
    // the destination the rescue case relies on.
    if (!(await this.authz.isOrgMember(userId, targetOrganizationId))) {
      return failure(AppError.forbidden(NOT_A_TARGET_MEMBER_MESSAGE));
    }

    const transferred = await this.repo.transferToOrganization({
      resourceType,
      resourceId,
      sourceOrganizationId,
      targetOrganizationId,
      userId,
      // Re-asked on the transaction's own handle, once its locks are held: the gate
      // above read a world that anyone holding `share` could still change.
      reauthorize: async (tx) =>
        (await this.authz.can(userId, { resourceType, resourceId, action: "manage" }, tx)).allow,
    });
    if (transferred.isFailure()) {
      return failure(transferred.error);
    }

    this.logger.log({
      msg: "Transferred a resource to another organization",
      operation: "transfer-resource-organization",
      resourceType,
      resourceId,
      sourceOrganizationId,
      targetOrganizationId,
      userId,
    });

    return success({ resourceType, resourceId, organizationId: targetOrganizationId });
  }
}
