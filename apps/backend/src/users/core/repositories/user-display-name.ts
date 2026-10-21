import { sql, users } from "@repo/database";

import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
  getAnonymizedAvatarUrl,
} from "../../../common/utils/profile-anonymization";

export function userMetadataFieldsSql() {
  return {
    firstName: sql<string>`CASE WHEN ${users.isAnonymous} THEN ${users.name} || ' (guest)' ELSE ${getAnonymizedFirstName()} END`,
    lastName: sql<string>`CASE WHEN ${users.isAnonymous} THEN '' ELSE ${getAnonymizedLastName()} END`,
    avatarUrl: sql<
      string | null
    >`CASE WHEN ${users.isAnonymous} THEN NULL ELSE ${getAnonymizedAvatarUrl()} END`,
  };
}
