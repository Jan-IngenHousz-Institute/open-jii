import { ORGANIZATION_MEMBERSHIP_LIMIT } from "@repo/database";

export interface AdmitMemberInput {
  organizationId: string;
  userId: string;
  role: string;
}

export type AdmitMemberOutcome =
  | "added"
  | "already-member"
  | "organization-gone"
  | "organization-full";

export const ORGANIZATION_FULL_MESSAGE =
  `This organization has reached its limit of ${ORGANIZATION_MEMBERSHIP_LIMIT} members. ` +
  `Remove someone before adding anyone else.`;
