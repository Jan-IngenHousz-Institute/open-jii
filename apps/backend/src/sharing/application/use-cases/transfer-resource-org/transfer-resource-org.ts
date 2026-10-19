import { Injectable, Logger } from "@nestjs/common";

import type {
  TransferResourceResponse,
  TransferableResourceType,
} from "@repo/api/domains/sharing/transfer-org/sharing-transfer-org.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
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
    private readonly notifications: NotificationDispatchService,
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

    await this.notify(userId, resourceType, resourceId, sourceOrganizationId, targetOrganizationId);

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

  /**
   * Tell everyone the move takes something from. The owners are the losing
   * organization's: the resource row already names the receiving one. A failure
   * here leaves the move standing.
   */
  private async notify(
    actorId: string,
    resourceType: TransferableResourceType,
    resourceId: string,
    sourceOrganizationId: string | null,
    targetOrganizationId: string,
  ): Promise<void> {
    const [members, name, organizationName] = await Promise.all([
      this.repo.listMemberIds(resourceType, resourceId, sourceOrganizationId),
      this.repo.findResourceName(resourceType, resourceId),
      this.repo.findOrganizationName(targetOrganizationId),
    ]);

    if (
      members.isFailure() ||
      name.isFailure() ||
      name.value === null ||
      organizationName.isFailure() ||
      organizationName.value === null
    ) {
      const failed = [members, name, organizationName].find((result) => result.isFailure());
      this.logger.error({
        msg: "Could not read who had access or what to call it, nobody was notified of the move",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "transfer-resource-organization",
        resourceType,
        resourceId,
        ...(failed?.isFailure() ? { error: failed.error } : {}),
      });
      return;
    }

    const dispatched = await this.notifications.dispatch({
      type: "resource_moved_organization",
      recipientIds: members.value,
      actorId,
      resource: { type: resourceType, id: resourceId },
      params: { resourceName: name.value, organizationName: organizationName.value },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to notify members, the resource was still moved",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "transfer-resource-organization",
        resourceType,
        resourceId,
        error: dispatched.error,
      });
    }
  }
}
