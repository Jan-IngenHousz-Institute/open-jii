import { Inject, Injectable } from "@nestjs/common";

import { eq, organizations, experiments } from "@repo/database";
import type { DatabaseInstance, DbOrTx } from "@repo/database";

import type { GuestResourceOwnership } from "../../../authorization/core/ports/guest-resource.port";

@Injectable()
export class GuestExperimentAccessRepository {
  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}
  async findOwnership(
    id: string,
    executor: DbOrTx = this.database,
  ): Promise<GuestResourceOwnership | null> {
    const rows = await executor
      .select({
        organizationId: experiments.organizationId,
        organizationType: organizations.type,
        visibility: experiments.visibility,
      })
      .from(experiments)
      .leftJoin(organizations, eq(organizations.id, experiments.organizationId))
      .where(eq(experiments.id, id))
      .limit(1);
    return rows.at(0) ?? null;
  }
}
