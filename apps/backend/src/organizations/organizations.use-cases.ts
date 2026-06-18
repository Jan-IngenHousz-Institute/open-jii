import { Injectable } from "@nestjs/common";

import { AppError, Result, failure, success } from "../common/utils/fp-utils";
import {
  JoinRequestRow,
  OrganizationResourcesRows,
  OrganizationSummaryRow,
  OrganizationsRepository,
} from "./organizations.repository";

const MANAGER_ROLES = new Set(["owner", "admin"]);

function isManager(role: string | null): boolean {
  if (!role) return false;
  return role.split(",").some((r) => MANAGER_ROLES.has(r.trim()));
}

@Injectable()
export class ListPublicOrganizationsUseCase {
  constructor(private readonly repo: OrganizationsRepository) {}

  execute(
    userId: string,
    opts: { search?: string; limit?: number; offset?: number },
  ): Promise<Result<OrganizationSummaryRow[]>> {
    return this.repo.listPublic(userId, {
      search: opts.search,
      limit: opts.limit ?? 24,
      offset: opts.offset ?? 0,
    });
  }
}

@Injectable()
export class GetOrganizationUseCase {
  constructor(private readonly repo: OrganizationsRepository) {}

  async execute(userId: string, organizationId: string): Promise<Result<OrganizationSummaryRow>> {
    const orgResult = await this.repo.findById(organizationId);
    if (orgResult.isFailure()) return failure(orgResult.error);
    const org = orgResult.value;
    if (!org) return failure(AppError.notFound("Organization not found"));

    if (org.visibility !== "public") {
      const role = await this.repo.memberRole(organizationId, userId);
      if (!role) return failure(AppError.forbidden("This organization is private"));
    }
    const [summary] = await this.repo.enrich(userId, [org]);
    return success(summary);
  }
}

@Injectable()
export class GetOrganizationResourcesUseCase {
  constructor(private readonly repo: OrganizationsRepository) {}

  async execute(organizationId: string): Promise<Result<OrganizationResourcesRows>> {
    const orgResult = await this.repo.findById(organizationId);
    if (orgResult.isFailure()) return failure(orgResult.error);
    if (!orgResult.value) return failure(AppError.notFound("Organization not found"));
    return this.repo.listPublicResources(organizationId);
  }
}

@Injectable()
export class RequestOrganizationJoinUseCase {
  constructor(private readonly repo: OrganizationsRepository) {}

  async execute(
    userId: string,
    organizationId: string,
    message: string | undefined,
  ): Promise<Result<{ joinRequest: JoinRequestRow; created: boolean }>> {
    const orgResult = await this.repo.findById(organizationId);
    if (orgResult.isFailure()) return failure(orgResult.error);
    const org = orgResult.value;
    if (!org) return failure(AppError.notFound("Organization not found"));
    if (org.visibility !== "public") {
      return failure(AppError.forbidden("This organization is not open to join requests"));
    }
    if (await this.repo.isMember(organizationId, userId)) {
      return failure(AppError.conflict("You are already a member of this organization"));
    }

    const existing = await this.repo.findPendingRequest(organizationId, userId);
    if (existing.isFailure()) return failure(existing.error);
    if (existing.value) return success({ joinRequest: existing.value, created: false });

    const created = await this.repo.createRequest(organizationId, userId, message);
    if (created.isFailure()) return failure(created.error);
    return success({ joinRequest: created.value, created: true });
  }
}

@Injectable()
export class ListOrganizationJoinRequestsUseCase {
  constructor(private readonly repo: OrganizationsRepository) {}

  async execute(userId: string, organizationId: string): Promise<Result<JoinRequestRow[]>> {
    const orgResult = await this.repo.findById(organizationId);
    if (orgResult.isFailure()) return failure(orgResult.error);
    if (!orgResult.value) return failure(AppError.notFound("Organization not found"));

    const role = await this.repo.memberRole(organizationId, userId);
    if (!isManager(role)) {
      return failure(AppError.forbidden("Only owners and admins can view join requests"));
    }
    return this.repo.listPendingRequests(organizationId);
  }
}

@Injectable()
export class DecideOrganizationJoinRequestUseCase {
  constructor(private readonly repo: OrganizationsRepository) {}

  async execute(
    userId: string,
    organizationId: string,
    requestId: string,
    decision: "approved" | "rejected",
  ): Promise<Result<JoinRequestRow>> {
    const orgResult = await this.repo.findById(organizationId);
    if (orgResult.isFailure()) return failure(orgResult.error);
    if (!orgResult.value) return failure(AppError.notFound("Organization not found"));

    const role = await this.repo.memberRole(organizationId, userId);
    if (!isManager(role)) {
      return failure(AppError.forbidden("Only owners and admins can decide join requests"));
    }

    const found = await this.repo.findRequestById(organizationId, requestId);
    if (found.isFailure()) return failure(found.error);
    const request = found.value;
    if (request?.status !== "pending") {
      return failure(AppError.notFound("Pending join request not found"));
    }

    if (decision === "approved") {
      const added = await this.repo.addMember(organizationId, request.user.id);
      if (added.isFailure()) return failure(added.error);
    }
    return this.repo.decideRequest(requestId, decision, userId);
  }
}

@Injectable()
export class CancelOrganizationJoinRequestUseCase {
  constructor(private readonly repo: OrganizationsRepository) {}

  async execute(
    userId: string,
    organizationId: string,
    requestId: string,
  ): Promise<Result<JoinRequestRow>> {
    const found = await this.repo.findRequestById(organizationId, requestId);
    if (found.isFailure()) return failure(found.error);
    const request = found.value;
    if (request?.status !== "pending") {
      return failure(AppError.notFound("Pending join request not found"));
    }
    if (request.user.id !== userId) {
      return failure(AppError.forbidden("You can only cancel your own join request"));
    }
    return this.repo.decideRequest(requestId, "cancelled", userId);
  }
}
