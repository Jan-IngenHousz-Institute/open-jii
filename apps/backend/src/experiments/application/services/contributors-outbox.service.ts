import { Injectable } from "@nestjs/common";

import { Result, success } from "../../../common/utils/fp-utils";
import type { UserProfileMetadata } from "../../../users/core/models/user.model";
import { UserRepository } from "../../../users/core/repositories/user.repository";
import { ContributorProfilesWarehouseRepository } from "../../core/repositories/contributor-profiles-warehouse.repository";
import { ExperimentDataOutboxService } from "./experiment-data-outbox.service";

// The outbox service base tells the records it found from the gone ones by `id`.
type ContributorRecord = UserProfileMetadata & { id: string };

/** A user without a profile is gone from the copy, so the pipelines give them an empty name. */
@Injectable()
export class ContributorsOutboxService extends ExperimentDataOutboxService<ContributorRecord> {
  constructor(
    private readonly users: UserRepository,
    private readonly warehouse: ContributorProfilesWarehouseRepository,
  ) {
    super();
  }

  protected async find(ids: string[]): Promise<Result<ContributorRecord[]>> {
    const found = await this.users.findUsersByIds(ids);
    if (found.isFailure()) {
      return found;
    }

    return success(found.value.map((profile) => ({ ...profile, id: profile.userId })));
  }

  protected async merge(records: ContributorRecord[]): Promise<Result<"merged" | "stopped">> {
    const merged = await this.warehouse.merge(records);
    return merged.map((): "merged" => "merged");
  }

  protected remove(ids: string[]): Promise<Result<void>> {
    return this.warehouse.delete(ids);
  }
}
