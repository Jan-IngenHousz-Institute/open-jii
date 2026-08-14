import { Inject, Injectable } from "@nestjs/common";

import type { PublicRegistryCounts } from "@repo/api/domains/metrics/metrics.schema";
import {
  and,
  count,
  eq,
  experiments,
  isNull,
  macros,
  organizations,
  profiles,
  protocols,
  users,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { tryCatch } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";

@Injectable()
export class MetricsRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async getRegistryCounts(): Promise<Result<PublicRegistryCounts>> {
    return tryCatch(async () => {
      // Same predicate the user directory uses for a real, discoverable
      // account: deleted and deactivated profiles must not inflate a public
      // headcount.
      const isLiveAccount = and(
        eq(users.registered, true),
        eq(profiles.activated, true),
        isNull(profiles.deletedAt),
      );

      const [registeredUsers, organizationCount, experimentCount, protocolCount, macroCount] =
        await Promise.all([
          this.database
            .select({ value: count() })
            .from(users)
            .innerJoin(profiles, eq(profiles.userId, users.id))
            .where(isLiveAccount),
          this.database.select({ value: count() }).from(organizations),
          this.database.select({ value: count() }).from(experiments),
          this.database.select({ value: count() }).from(protocols),
          this.database.select({ value: count() }).from(macros),
        ]);

      return {
        registeredUsers: registeredUsers[0]?.value ?? 0,
        organizations: organizationCount[0]?.value ?? 0,
        experiments: experimentCount[0]?.value ?? 0,
        protocols: protocolCount[0]?.value ?? 0,
        macros: macroCount[0]?.value ?? 0,
      };
    });
  }
}
