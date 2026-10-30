import type {
  GrantRole,
  GranteeUserDto,
  OrganizationMemberRole,
  ShareableRole,
  SharingGranteeType,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";

import type { Translate } from "../people/person-name";
import type { PickerRow } from "../people/picking/picking-rule";
import { describeSearchedUser } from "../people/picking/picking-rule";
import type { GranteeAccess } from "./collaborator-roles";
import { holdsEveryGrantableAction, roleLabelKey, roleRaisesAccess } from "./collaborator-roles";

// Each key inside its own `t()` call, which is the only form the string guard scans.
export const orgRoleBadge = (t: Translate): Record<OrganizationMemberRole, string> => ({
  owner: t("sharing.orgOwnerBadge"),
  admin: t("sharing.orgAdminBadge"),
  member: t("sharing.orgMemberBadge"),
});

const ownsResource = (t: Translate): Record<SharingResourceType, string> => ({
  experiment: t("sharing.ownsResource.experiment"),
  macro: t("sharing.ownsResource.macro"),
  protocol: t("sharing.ownsResource.protocol"),
  workbook: t("sharing.ownsResource.workbook"),
  device: t("sharing.ownsResource.device"),
  device_group: t("sharing.ownsResource.deviceGroup"),
  calibration_definition: t("sharing.ownsResource.calibrationDefinition"),
});

export interface ExistingGrant {
  granteeType: SharingGranteeType;
  granteeId: string;
  role: GrantRole;
}

export interface SelectedGrantee {
  type: SharingGranteeType;
  id: string;
  displayName: string;
  /**
   * The access they already hold, carried so the host can re-check the tier it is about
   * to grant: the level select is free to move after the row was picked.
   */
  access: GranteeAccess;
}

export interface ShareContext {
  resourceType: SharingResourceType;
  /** The level the host will grant; a candidate it would not raise is greyed out. */
  role: ShareableRole;
  /** The typed term when it is a complete address, for the match hint. */
  typedEmail: string | null;
  existingGrants: readonly ExistingGrant[];
  /** Its members already reach the resource through their roles, so it is never offered. */
  owningOrganizationId: string | null;
  t: Translate;
}

/**
 * Why granting `role` would change nothing for this candidate, or `null` when it raises
 * their access. A ceiling names its source: claiming the organization for a grant holder
 * with no role there describes access they do not have.
 */
export function shareUnavailableReason(
  access: GranteeAccess,
  role: ShareableRole,
  resourceType: SharingResourceType,
  t: Translate,
): string | null {
  if (holdsEveryGrantableAction(access, resourceType)) {
    const orgRoleAlone = { organizationRole: access.organizationRole, existingGrantRole: null };
    return holdsEveryGrantableAction(orgRoleAlone, resourceType)
      ? t("sharing.granteeHasFullAccess")
      : t("sharing.granteeHasFullAccessViaGrant");
  }
  return roleRaisesAccess(access, role, resourceType) ? null : t("sharing.granteeTierAddsNothing");
}

function existingGrantBadge(role: GrantRole | null, t: Translate): string[] {
  return role ? [t(roleLabelKey(role))] : [];
}

export function describeShareUser(
  user: GranteeUserDto,
  context: ShareContext,
): PickerRow<SelectedGrantee> {
  const { t } = context;
  const access: GranteeAccess = {
    organizationRole: user.organizationRole,
    existingGrantRole: user.existingGrantRole,
  };
  const row = describeSearchedUser(user, {
    typedEmail: context.typedEmail,
    t,
    reason: shareUnavailableReason(access, context.role, context.resourceType, t),
    badges: [
      ...(user.organizationRole ? [orgRoleBadge(t)[user.organizationRole]] : []),
      ...existingGrantBadge(user.existingGrantRole, t),
    ],
  });
  return { ...row, value: { type: "user", id: user.userId, displayName: row.label, access } };
}

export function describeGroup(
  type: "team" | "organization",
  group: { id: string; name: string },
  identityLine: string,
  context: ShareContext,
): PickerRow<SelectedGrantee> {
  const grant = context.existingGrants.find(
    (existing) => existing.granteeType === type && existing.granteeId === group.id,
  );
  const access: GranteeAccess = { organizationRole: null, existingGrantRole: grant?.role ?? null };

  return {
    key: `${type}-${group.id}`,
    kind: type,
    label: group.name,
    person: null,
    identityLine,
    badges: existingGrantBadge(access.existingGrantRole, context.t),
    unavailableReason:
      type === "organization" && group.id === context.owningOrganizationId
        ? ownsResource(context.t)[context.resourceType]
        : shareUnavailableReason(access, context.role, context.resourceType, context.t),
    value: { type, id: group.id, displayName: group.name, access },
  };
}
