/**
 * Experiment access and permission rules, mirroring the backend use-case
 * guards in `apps/backend/src/experiments/application/use-cases/`:
 * `checkAccess` (member/admin derivation, `hasArchiveAccess`), the
 * update-experiment archived invariant (archived ⇒ status-only edits),
 * member-admin guards, and the join-request lifecycle guards. Components
 * and hooks call these instead of re-deriving role/status checks inline.
 */
import type {
  Experiment,
  ExperimentJoinRequest,
  ExperimentMember,
  UpdateExperimentBody,
} from "@repo/api/schemas/experiment.schema";

export interface ExperimentAccessContext {
  isAdmin: boolean;
  isArchived: boolean;
}

export function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}

export function findMember(
  members: readonly ExperimentMember[],
  userId: string | undefined,
): ExperimentMember | undefined {
  return userId ? members.find((m) => m.user.id === userId) : undefined;
}

export function countAdmins(members: readonly { role?: string }[]): number {
  return members.filter((m) => isAdmin(m.role)).length;
}

// "Cannot remove/demote the last admin" (remove-experiment-member, update-experiment-member-role).
export function isLastAdmin(role: string | undefined, adminCount: number): boolean {
  return isAdmin(role) && adminCount === 1;
}

export function isExperimentArchived(experiment: Pick<Experiment, "status">): boolean {
  return experiment.status === "archived";
}

export function isExperimentPublic(experiment: Pick<Experiment, "visibility">): boolean {
  return experiment.visibility === "public";
}

// Mirrors checkAccess's hasArchiveAccess: write access is admin-only and lost when archived.
export function hasArchiveAccess(access: ExperimentAccessContext): boolean {
  return access.isAdmin && !access.isArchived;
}

export function canEditExperiment(access: ExperimentAccessContext): boolean {
  return hasArchiveAccess(access);
}

// add-experiment-members / update-experiment-member-role / invitation updates.
export function canManageMembers(access: ExperimentAccessContext): boolean {
  return hasArchiveAccess(access);
}

// approve-join-request / reject-join-request.
export function canManageJoinRequests(access: ExperimentAccessContext): boolean {
  return hasArchiveAccess(access);
}

// The archived invariant: archived experiments accept status-only updates.
export function isStatusOnlyUpdate(update: UpdateExperimentBody): boolean {
  const fields = (Object.keys(update) as (keyof UpdateExperimentBody)[]).filter(
    (key) => update[key] !== undefined,
  );
  return fields.length === 1 && fields[0] === "status";
}

export function canUpdateExperiment(
  access: { isAdmin: boolean },
  experiment: Pick<Experiment, "status">,
  update: UpdateExperimentBody,
): boolean {
  if (!access.isAdmin) return false;
  return !isExperimentArchived(experiment) || isStatusOnlyUpdate(update);
}

// request-join-experiment: public, not archived, not already a member.
// Callers additionally require an authenticated user.
export function canRequestToJoinExperiment(
  experiment: Pick<Experiment, "visibility">,
  ctx: { isArchived: boolean; isMember: boolean },
): boolean {
  return !ctx.isMember && !ctx.isArchived && isExperimentPublic(experiment);
}

export function isJoinRequestPending(request: Pick<ExperimentJoinRequest, "status">): boolean {
  return request.status === "pending";
}

export function canApproveJoinRequest(
  request: Pick<ExperimentJoinRequest, "status">,
  access: ExperimentAccessContext,
): boolean {
  return isJoinRequestPending(request) && canManageJoinRequests(access);
}

export function canRejectJoinRequest(
  request: Pick<ExperimentJoinRequest, "status">,
  access: ExperimentAccessContext,
): boolean {
  return isJoinRequestPending(request) && canManageJoinRequests(access);
}

// cancel-join-request: only the requester cancels, and only while pending.
export function canCancelJoinRequest(
  request: Pick<ExperimentJoinRequest, "status" | "user">,
  userId: string | undefined,
): boolean {
  return Boolean(userId) && request.user.id === userId && isJoinRequestPending(request);
}
