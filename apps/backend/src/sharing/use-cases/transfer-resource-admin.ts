import { Injectable, Logger } from "@nestjs/common";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { AuthorizationService } from "../../authorization/authorization.service";
import { Result, success } from "../../common/utils/fp-utils";
import { SharingRepository } from "../sharing.repository";

export interface AdminTransfer {
  resourceType: SharingResourceType;
  resourceId: string;
  targetUserId: string;
}

export interface AdminTransferResult {
  resourceType: SharingResourceType;
  resourceId: string;
  success: boolean;
  error?: string;
}

/**
 * Hands admin rights off in bulk so a user can clear their account-deletion
 * blockers in one step. Any shareable type can be a blocker, so this takes them
 * all — including devices, which is what keeps a device from dead-ending the
 * chain: its only exits are handing it over here or deleting it. For each
 * (resource, target):
 *   - the caller must be able to share the resource (authorization);
 *   - the target receives a direct `admin` grant, the surface that owns access
 *     tiers.
 *
 * This is intentionally allowed on archived experiments — it is the single
 * controlled path for ownership hand-off during account deletion, and it talks to
 * the repository directly rather than going through the guarded sharing use cases.
 * Archived experiments stay immutable everywhere else.
 *
 * Each transfer succeeds or fails independently; the caller gets a per-resource
 * result so the UI can keep any rows that could not be resolved.
 */
@Injectable()
export class TransferResourceAdminUseCase {
  private readonly logger = new Logger(TransferResourceAdminUseCase.name);

  constructor(
    private readonly repo: SharingRepository,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(
    transfers: AdminTransfer[],
    currentUserId: string,
  ): Promise<Result<AdminTransferResult[]>> {
    this.logger.log({
      msg: "Transferring resource admin rights",
      operation: "transfer-resource-admin",
      userId: currentUserId,
      transferCount: transfers.length,
    });

    const results: AdminTransferResult[] = [];
    for (const transfer of transfers) {
      results.push(await this.transferOne(transfer, currentUserId));
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.length - succeeded;
    const status = failed === 0 ? "success" : succeeded === 0 ? "failed" : "partial";

    this.logger.log({
      msg: "Finished transferring resource admin rights",
      operation: "transfer-resource-admin",
      userId: currentUserId,
      succeeded,
      failed,
      status,
    });

    return success(results);
  }

  private async transferOne(
    { resourceType, resourceId, targetUserId }: AdminTransfer,
    currentUserId: string,
  ): Promise<AdminTransferResult> {
    const fail = (error: string): AdminTransferResult => {
      this.logger.warn({
        msg: "Admin transfer skipped",
        operation: "transfer-resource-admin",
        resourceType,
        resourceId,
        targetUserId,
        userId: currentUserId,
        reason: error,
      });
      return { resourceType, resourceId, success: false, error };
    };

    // Managing collaborators is what handing admin rights off is, so `share` is the
    // authorization — and a missing resource denies here (`can()` answers
    // "not-found"), so nothing else needs to look it up.
    const decision = await this.authz.can(currentUserId, {
      resourceType,
      resourceId,
      action: "share",
    });
    if (!decision.allow) {
      // One answer for both of `can()`'s negatives. Telling "no such resource" apart
      // from "exists, but not yours" would let any authenticated caller confirm that a
      // uuid names a real resource of a given type, with no grant or membership
      // needed — the same uniform posture the leave route takes.
      return fail("You have no access to transfer admin rights on this resource");
    }

    // The target must be someone the caller could have shared with in the first
    // place: an activated, non-deleted account. Handing admin to a closed account
    // would leave the resource unstaffed again.
    if (!(await this.repo.granteeIsSelectable("user", targetUserId, currentUserId))) {
      return fail("Target user is not available");
    }

    // Idempotent, so a re-run (or a target who already holds admin/owner) is a
    // harmless no-op.
    const grantResult = await this.repo.ensureDirectAdminGrant({
      resourceType,
      resourceId,
      userId: targetUserId,
      createdBy: currentUserId,
    });
    if (grantResult.isFailure()) {
      return fail("Failed to assign admin role");
    }

    return { resourceType, resourceId, success: true };
  }
}
