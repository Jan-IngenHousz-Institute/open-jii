import { Injectable, Inject } from "@nestjs/common";

import type { StatementParameter } from "../../../common/modules/databricks/services/sql/sql.types";
import { AppError, failure, Result, success } from "../../../common/utils/fp-utils";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";

/** A contributor's profile as every page shows it: "Unknown User" once they deactivate it. */
export interface ContributorProfile {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

/**
 * The lakehouse's copy of contributors' profiles, `centrum.contributor_profiles`, which the
 * pipelines join to name the people behind an experiment's rows. Postgres holds the profiles; the
 * experiment data outbox keeps this copy to their state.
 */
@Injectable()
export class ContributorProfilesWarehouseRepository {
  constructor(
    @Inject(DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  /** Writes each profile as Postgres holds it, inserting the ones the copy lacks. */
  async merge(profiles: ContributorProfile[]): Promise<Result<void>> {
    if (profiles.length === 0) {
      return success(undefined);
    }

    const parameters: StatementParameter[] = [];
    const rows = profiles.map((profile, i) => {
      parameters.push(
        { name: `user_id_${i}`, value: profile.id },
        { name: `first_name_${i}`, value: profile.firstName },
        { name: `last_name_${i}`, value: profile.lastName },
        { name: `avatar_url_${i}`, value: profile.avatarUrl ?? undefined },
      );
      return `(:user_id_${i}, :first_name_${i}, :last_name_${i}, CAST(:avatar_url_${i} AS STRING))`;
    });

    const statement = `
      MERGE INTO contributor_profiles AS target
      USING (
        SELECT * FROM VALUES ${rows.join(", ")}
        AS copy(user_id, first_name, last_name, avatar_url)
      ) AS source
      ON target.user_id = source.user_id
      WHEN MATCHED THEN UPDATE SET
        first_name = source.first_name, last_name = source.last_name, avatar_url = source.avatar_url
      WHEN NOT MATCHED THEN INSERT (user_id, first_name, last_name, avatar_url)
        VALUES (source.user_id, source.first_name, source.last_name, source.avatar_url)
    `;

    return this.execute(statement, parameters, "merge contributor profiles");
  }

  /** Deletes the copies of profiles Postgres no longer holds. */
  async delete(userIds: string[]): Promise<Result<void>> {
    if (userIds.length === 0) {
      return success(undefined);
    }

    const parameters = userIds.map((id, i) => ({ name: `user_id_${i}`, value: id }));
    const statement = `
      DELETE FROM contributor_profiles
      WHERE user_id IN (${parameters.map(({ name }) => `:${name}`).join(", ")})
    `;

    return this.execute(statement, parameters, "delete contributor profiles");
  }

  private async execute(
    statement: string,
    parameters: StatementParameter[],
    what: string,
  ): Promise<Result<void>> {
    const result = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      statement,
      parameters,
    );
    if (result.isFailure()) {
      return failure(AppError.internal(`Failed to ${what}: ${result.error.message}`));
    }

    return success(undefined);
  }
}
