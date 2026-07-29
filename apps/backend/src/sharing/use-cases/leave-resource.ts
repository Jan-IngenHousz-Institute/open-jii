import { Injectable } from "@nestjs/common";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { AppError, Result, failure, success } from "../../common/utils/fp-utils";
import { SharingRepository } from "../sharing.repository";

/**
 * Give up the caller's own direct grant. The one sharing operation NOT gated on
 * `can(share)` — the caller's own grant IS the authority, which is what lets a
 * "Can view" grantee remove themselves even though the collaborators list is
 * invisible to them.
 *
 * No `can()` call and no resource lookup happen at all: the answer depends only
 * on the caller's own rows. Holding no direct grant — whether the resource is
 * missing, private-and-invisible, or reachable only via an organization grant,
 * org role, or public visibility — is one uniform 404, so this route discloses
 * nothing about the resource or its other grantees.
 *
 * Access may survive the leave through another precedence tier (org role,
 * org grant, public read); the UI says so rather than promising otherwise.
 *
 * The last-admin staffing invariant still applies (inside `repo.leave`'s
 * transaction): an experiment's last admin cannot leave it.
 */
@Injectable()
export class LeaveResourceUseCase {
  constructor(private readonly repo: SharingRepository) {}

  async execute(
    userId: string,
    resourceType: SharingResourceType,
    resourceId: string,
  ): Promise<Result<void>> {
    const deleted = await this.repo.leave({ resourceType, resourceId, userId });
    if (deleted.isFailure()) {
      return failure(deleted.error);
    }
    if (deleted.value === null) {
      return failure(AppError.notFound("You have no direct access to leave on this resource"));
    }

    return success(undefined);
  }
}
