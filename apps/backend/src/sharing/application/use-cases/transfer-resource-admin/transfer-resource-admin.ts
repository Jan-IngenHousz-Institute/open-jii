import { Injectable, Logger } from "@nestjs/common";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { Result, success } from "../../../../common/utils/fp-utils";
import { SharingRepository } from "../../../core/repositories/sharing.repository";

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
 * blockers in one step. Any shareable type can be a blocker, so this takes them all
 * — including devices, whose only exits are being handed over here or deleted.
 *
 * Intentionally allowed on archived experiments (which stay immutable everywhere
 * else): this is the single controlled hand-off path during account deletion, so it
 * talks to the repository directly rather than through the guarded use cases.
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

    // `share` is the authorization, and a missing resource denies here (`can()`
    // answers "not-found"), so nothing else needs to look it up.
    const decision = await this.authz.can(currentUserId, {
      resourceType,
      resourceId,
      action: "share",
    });
    if (!decision.allow) {
      // One answer for both of `can()`'s negatives: telling "no such resource" apart
      // from "exists, but not yours" would let any authenticated caller confirm a
      // uuid names a real resource, with no grant or membership needed.
      return fail("You have no access to transfer admin rights on this resource");
    }

    // The target must be someone the caller could have shared with: handing admin to
    // a closed or deactivated account would leave the resource unstaffed again.
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
