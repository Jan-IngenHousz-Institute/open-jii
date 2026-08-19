import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { ORGANIZATION_FULL_MESSAGE } from "../../../core/admit-member";
import type { OrganizationJoinRequestDto } from "../../../core/models/organization-join-request.model";
import { canManageMembership, canViewOrganization } from "../../../core/organization-access";
import { ORGANIZATION_EMAIL_PORT } from "../../../core/ports/email.port";
import type { OrganizationEmailPort } from "../../../core/ports/email.port";
import { OrganizationJoinRequestRepository } from "../../../core/repositories/organization-join-request.repository";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

export type JoinRequestDecision = "approve" | "reject";

/**
 * Approving or rejecting a join request. Approval is one of the two places where
 * this module writes a Better Auth model directly: the member row and the status
 * flip have to land together, or a crash between them either admits somebody
 * against a still-pending request or resolves a request that admitted nobody.
 */
@Injectable()
export class DecideOrganizationJoinRequestUseCase {
  private readonly logger = new Logger(DecideOrganizationJoinRequestUseCase.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly joinRequestRepository: OrganizationJoinRequestRepository,
    @Inject(ORGANIZATION_EMAIL_PORT) private readonly emailPort: OrganizationEmailPort,
  ) {}

  async execute(
    organizationId: string,
    requestId: string,
    decision: JoinRequestDecision,
    currentUserId: string,
  ): Promise<Result<OrganizationJoinRequestDto>> {
    this.logger.log({
      msg: "Deciding an organization join request",
      operation: "decide-organization-join-request",
      organizationId,
      requestId,
      decision,
      userId: currentUserId,
    });

    const accessResult = await this.organizationRepository.findAccess(
      organizationId,
      currentUserId,
    );
    if (accessResult.isFailure()) {
      return failure(AppError.internal("Failed to load organization"));
    }
    const access = accessResult.value;
    if (!access || !canViewOrganization(access)) {
      return failure(AppError.notFound(`Organization with ID ${organizationId} not found`));
    }
    if (!canManageMembership(access)) {
      return failure(AppError.forbidden("Only owners and admins can decide join requests"));
    }

    const requestResult = await this.joinRequestRepository.findById(requestId);
    if (requestResult.isFailure()) {
      return failure(AppError.internal("Failed to load join request"));
    }
    const existing = requestResult.value;
    // Scoped to the organization in the path, so a request id from another
    // organization cannot be decided through this route.
    if (existing?.organizationId !== organizationId) {
      return failure(AppError.notFound(`Join request ${requestId} not found`));
    }
    if (existing.status !== "pending") {
      return failure(AppError.conflict("Join request is no longer pending", ErrorCodes.CONFLICT));
    }

    return decision === "approve"
      ? this.approve(organizationId, requestId, existing, currentUserId)
      : this.reject(organizationId, requestId, existing, currentUserId);
  }

  private async approve(
    organizationId: string,
    requestId: string,
    existing: OrganizationJoinRequestDto,
    currentUserId: string,
  ): Promise<Result<OrganizationJoinRequestDto>> {
    const approveResult = await this.joinRequestRepository.approve(
      requestId,
      existing.user.id,
      organizationId,
      currentUserId,
    );
    if (approveResult.isFailure()) {
      this.logger.error({
        msg: "Failed to approve organization join request",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "decide-organization-join-request",
        organizationId,
        requestId,
        error: approveResult.error,
      });
      return failure(AppError.internal("Failed to approve join request"));
    }
    if (approveResult.value.outcome === "not-pending") {
      return failure(AppError.conflict("Join request is no longer pending", ErrorCodes.CONFLICT));
    }
    // The request is still pending — the approval was undone — so the reviewer can take
    // the same decision again once the organization has room.
    if (approveResult.value.outcome === "organization-full") {
      return failure(AppError.conflict(ORGANIZATION_FULL_MESSAGE, ErrorCodes.CONFLICT));
    }

    const approved = approveResult.value.request;
    await this.notifyRequester(organizationId, approved, "approve");
    return success(approved);
  }

  private async reject(
    organizationId: string,
    requestId: string,
    existing: OrganizationJoinRequestDto,
    currentUserId: string,
  ): Promise<Result<OrganizationJoinRequestDto>> {
    const rejectResult = await this.joinRequestRepository.markDecided(
      requestId,
      "rejected",
      currentUserId,
    );
    if (rejectResult.isFailure()) {
      this.logger.error({
        msg: "Failed to reject organization join request",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "decide-organization-join-request",
        organizationId,
        requestId,
        error: rejectResult.error,
      });
      return failure(AppError.internal("Failed to reject join request"));
    }
    if (!rejectResult.value) {
      return failure(AppError.conflict("Join request is no longer pending", ErrorCodes.CONFLICT));
    }

    await this.notifyRequester(organizationId, rejectResult.value, "reject");
    return success(rejectResult.value);
  }

  /** A failed notification never undoes a decision that already landed. */
  private async notifyRequester(
    organizationId: string,
    request: OrganizationJoinRequestDto,
    decision: JoinRequestDecision,
  ): Promise<void> {
    if (!request.user.email) return;

    // No viewer: this reads the name to compose an email and discards the count.
    const profileResult = await this.organizationRepository.findProfileFields(
      organizationId,
      undefined,
    );
    if (profileResult.isFailure() || !profileResult.value) {
      this.logger.error({
        msg: "Failed to load the organization for a join request decision email",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "decide-organization-join-request",
        organizationId,
      });
      return;
    }

    const organizationName = profileResult.value.name;
    const emailResult =
      decision === "approve"
        ? await this.emailPort.sendOrganizationJoinRequestApprovedNotification(
            organizationId,
            organizationName,
            request.user.email,
          )
        : await this.emailPort.sendOrganizationJoinRequestRejectedNotification(
            organizationId,
            organizationName,
            request.user.email,
          );

    if (emailResult.isFailure()) {
      this.logger.error({
        msg: "Failed to send a join request decision email, the decision still stands",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "decide-organization-join-request",
        organizationId,
        requestId: request.id,
        email: request.user.email,
      });
    }
  }
}
