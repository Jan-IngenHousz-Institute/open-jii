import { users } from "@repo/database";

import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
  getAnonymizedAvatarUrl,
} from "../../../common/utils/profile-anonymization";

export function userMetadataFields() {
  return {
    isAnonymous: users.isAnonymous,
    name: users.name,
    firstName: getAnonymizedFirstName(),
    lastName: getAnonymizedLastName(),
    avatarUrl: getAnonymizedAvatarUrl(),
  };
}

interface UserDisplayFields {
  isAnonymous: boolean | null;
  name: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  email?: string | null;
}

export function mapUserMetadata<T extends UserDisplayFields>(row: T) {
  const { isAnonymous, name, ...fields } = row;
  const result = {
    ...fields,
    isGuest: isAnonymous === true,
    isFormerGuest: false,
    firstName: isAnonymous ? (name ?? "Guest") : row.firstName,
    lastName: isAnonymous ? "" : row.lastName,
    avatarUrl: isAnonymous ? null : row.avatarUrl,
  };
  return isAnonymous && "email" in result ? { ...result, email: null } : result;
}
