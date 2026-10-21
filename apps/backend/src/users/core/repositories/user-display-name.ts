import { profiles, sql, users } from "@repo/database";

import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
  getAnonymizedAvatarUrl,
} from "../../../common/utils/profile-anonymization";

export function userDisplayNameSql() {
  return sql<string>`coalesce(nullif(trim(concat(${profiles.firstName}, ' ', ${profiles.lastName})), ''), ${users.name})`;
}

export function userMetadataFieldsSql() {
  return {
    isGuest: users.isAnonymous,
    isFormerGuest: sql<boolean>`false`,
    firstName: sql<string>`CASE WHEN ${users.isAnonymous} THEN ${users.name} ELSE ${getAnonymizedFirstName()} END`,
    lastName: sql<string>`CASE WHEN ${users.isAnonymous} THEN '' ELSE ${getAnonymizedLastName()} END`,
    avatarUrl: sql<
      string | null
    >`CASE WHEN ${users.isAnonymous} THEN NULL ELSE ${getAnonymizedAvatarUrl()} END`,
  };
}
