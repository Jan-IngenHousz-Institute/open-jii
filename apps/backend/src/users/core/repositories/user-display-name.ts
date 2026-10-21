import { profiles, sql, users } from "@repo/database";

export function userDisplayNameSql() {
  return sql<string>`coalesce(nullif(trim(concat(${profiles.firstName}, ' ', ${profiles.lastName})), ''), ${users.name})`;
}
