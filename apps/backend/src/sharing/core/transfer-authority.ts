import type { DbOrTx } from "@repo/database";

import { orgHasLivingFullControlMember, orgRoleConfersFullControl } from "./resource-staffing";

/**
 * Whether `userId` may move a resource **out** of the organization that owns it.
 *
 * Access to the resource is a separate question, answered by `can(manage)` before
 * this one. This is about authority over the organization: normally its owners and
 * admins alone, since a transfer takes the resource away from everyone else there.
 * A grant holder can never satisfy that — which is the point, or any collaborator
 * with an edit tier could move somebody else's work into their own workspace and
 * lock the organization out of it.
 *
 * The one exception is the case that has nobody to expropriate from: an
 * organization where **nobody inside can still act** — every owner *and* admin has
 * closed their account. Its resources would otherwise be stranded, with nobody left
 * to move them and no way to delete the organization while it still owns them, so
 * whoever still has full control through a grant is allowed to carry them out. A
 * resource with no owning organization at all is the same situation.
 *
 * Owners *and* admins, not owners alone: an organization that merely lost its owner
 * is still running, and treating it as abandoned would hand its resources to any
 * outside collaborator holding an edit tier — precisely the expropriation this gate
 * exists to prevent. The narrower owner-only test belongs to answerability
 * (staffing, account deletion), which asks a different question.
 */
export async function mayTransferOutOfOrganization(
  db: DbOrTx,
  organizationId: string | null,
  userId: string,
): Promise<boolean> {
  if (organizationId && (await orgRoleConfersFullControl(db, organizationId, userId))) {
    return true;
  }
  return !(await orgHasLivingFullControlMember(db, organizationId));
}
