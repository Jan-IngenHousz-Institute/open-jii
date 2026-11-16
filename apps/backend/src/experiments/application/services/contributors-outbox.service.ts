import { Injectable } from "@nestjs/common";

import { Result, success } from "../../../common/utils/fp-utils";
import { UserRepository } from "../../../users/core/repositories/user.repository";
import type { ContributorProfile } from "../../core/models/contributor-profile.model";
import { ContributorProfilesWarehouseRepository } from "../../core/repositories/contributor-profiles-warehouse.repository";
import { ExperimentDataOutboxService } from "./experiment-data-outbox.service";

/** A user without a profile is gone from the copy, so the pipelines give them an empty name. */
@Injectable()
export class ContributorsOutboxService extends ExperimentDataOutboxService<ContributorProfile> {
  constructor(
    private readonly users: UserRepository,
    private readonly warehouse: ContributorProfilesWarehouseRepository,
  ) {
    super();
  }

  protected async find(ids: string[]): Promise<Result<ContributorProfile[]>> {
    const found = await this.users.findUsersByIds(ids);
    if (found.isFailure()) {
      return found;
    }

    return success(found.value.map(({ userId, ...profile }) => ({ id: userId, ...profile })));
  }

  protected async merge(records: ContributorProfile[]): Promise<Result<"merged" | "stopped">> {
    const merged = await this.warehouse.merge(records);
    return merged.map((): "merged" => "merged");
  }

  protected remove(ids: string[]): Promise<Result<void>> {
    return this.warehouse.delete(ids);
  }
}
