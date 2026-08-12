import { Inject, Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import type { OrganizationJoinRequestDto } from "../../../core/models/organization-join-request.model";
import { isOrganizationMember, isPersonalWorkspace } from "../../../core/organization-access";
import { ORGANIZATION_EMAIL_PORT } from "../../../core/ports/email.port";
import type { OrganizationEmailPort } from "../../../core/ports/email.port";
import { OrganizationJoinRequestRepository } from "../../../core/repositories/organization-join-request.repository";
import { OrganizationRepository } from "../../../core/repositories/organization.repository";

/**
 * Asking to join an organization. Public, non-personal organizations only, and
 * never one the caller already belongs to. A private organization answers 404 for
 * the same reason its profile does — a refusal would confirm the id exists.
 */
@Injectable()
export class RequestJoinOrganizationUseCase {
  private readonly logger = new Logger(RequestJoinOrganizationUseCase.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly joinRequestRepository: OrganizationJoinRequestRepository,
    @Inject(ORGANIZATION_EMAIL_PORT) private readonly emailPort: OrganizationEmailPort,
  ) {}

  async execute(
    organizationId: string,
    userId: string,
    message: string | undefined,
  ): Promise<Result<{ joinRequest: OrganizationJoinRequestDto; created: boolean }>> {
    this.logger.log({
      msg: "Creating an organization join request",
      operation: "request-join-organization",
      organizationId,
      userId,
    });

    const rejection = await this.joinabilityRejection(organizationId, userId);
    if (rejection) {
      return failure(rejection);
    }

    // Dedup rather than collide with the partial unique index: re-submitting
    // returns the request that is already waiting.
    const existingResult = await this.joinRequestRepository.findPendingByOrganizationAndUser(
      organizationId,
      userId,
    );
    if (existingResult.isFailure()) {
      return failure(AppError.internal("Failed to check existing join request"));
    }
    if (existingResult.value) {
      return success({ joinRequest: existingResult.value, created: false });
    }

    const createResult = await this.joinRequestRepository.createIfJoinable(
      organizationId,
      userId,
      message,
    );
    if (createResult.isFailure()) {
      // A concurrent submit won the partial unique index between the dedup read
      // and this insert. The request the caller wanted exists — say that, rather
      // than reporting a server fault for a state they asked for.
      if (createResult.error.code === "REPOSITORY_DUPLICATE") {
        return failure(
          AppError.conflict(
            "You already have a pending request for this organization",
            ErrorCodes.CONFLICT,
          ),
        );
      }

      this.logger.error({
        msg: "Failed to create organization join request",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "request-join-organization",
        organizationId,
        userId,
        error: createResult.error,
      });
      return failure(AppError.internal("Failed to create join request"));
    }

    if (createResult.value.outcome === "not-joinable") {
      // The insert's own predicate refused: the organization stopped being
      // joinable after the check above. Re-read to answer with the reason that is
      // true now rather than the one that was true a moment ago.
      const currentRejection = await this.joinabilityRejection(organizationId, userId);
      return failure(
        currentRejection ??
          AppError.conflict(
            "This organization is no longer open to join requests",
            ErrorCodes.CONFLICT,
          ),
      );
    }

    const joinRequest = createResult.value.request;
    await this.notifyDeciders(organizationId, joinRequest);

    return success({ joinRequest, created: true });
  }

  /**
   * Why the caller may not ask to join, or `null` when they may. Runs before the
   * insert to give a precise answer, and again if the insert's own predicate
   * refuses — the two together are what make the refusal both accurate and
   * race-free, since only the predicate inside the insert is authoritative.
   */
  private async joinabilityRejection(
    organizationId: string,
    userId: string,
  ): Promise<AppError | null> {
    const accessResult = await this.organizationRepository.findAccess(organizationId, userId);
    if (accessResult.isFailure()) {
      return AppError.internal("Failed to load organization");
    }
    const access = accessResult.value;

    // Personal workspaces and private organizations are both "no such organization"
    // here: neither is joinable, and neither should be confirmable by probing.
    if (!access || isPersonalWorkspace(access) || access.visibility !== "public") {
      return AppError.notFound(`Organization with ID ${organizationId} not found`);
    }

    if (isOrganizationMember(access)) {
      return AppError.conflict(
        "You are already a member of this organization",
        ErrorCodes.CONFLICT,
      );
    }

    return null;
  }

  /** Owners and admins decide requests, so they are who hears about a new one. */
  private async notifyDeciders(
    organizationId: string,
    joinRequest: OrganizationJoinRequestDto,
  ): Promise<void> {
    const [profileResult, emailsResult] = await Promise.all([
      // Name only, for the notification email; see the note on the decide path.
      this.organizationRepository.findProfileFields(organizationId, undefined),
      this.organizationRepository.listDeciderEmails(organizationId),
    ]);

    if (profileResult.isFailure() || !profileResult.value || emailsResult.isFailure()) {
      this.logger.error({
        msg: "Failed to look up join request notification recipients",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        operation: "request-join-organization",
        organizationId,
      });
      return;
    }

    const organizationName = profileResult.value.name;
    const requesterName = `${joinRequest.user.firstName} ${joinRequest.user.lastName}`;

    for (const recipientEmail of emailsResult.value) {
      const emailResult = await this.emailPort.sendOrganizationJoinRequestSubmittedNotification(
        organizationId,
        organizationName,
        requesterName,
        recipientEmail,
        joinRequest.message ?? undefined,
      );

      if (emailResult.isFailure()) {
        this.logger.error({
          msg: "Failed to notify a decider, the join request was still created",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          operation: "request-join-organization",
          organizationId,
          email: recipientEmail,
        });
      }
    }
  }
}
