import { faker } from "@faker-js/faker";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { UserProfileMetadata } from "../../../users/core/models/user.model";
import type { DatabricksPort } from "../ports/databricks.port";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import { ContributorProfilesWarehouseRepository } from "./contributor-profiles-warehouse.repository";

describe("ContributorProfilesWarehouseRepository", () => {
  const testApp = TestHarness.App;
  let repository: ContributorProfilesWarehouseRepository;
  let databricksPort: DatabricksPort;

  const nothing: SchemaData = { columns: [], rows: [], totalRows: 0, truncated: false };

  function profile(overrides: Partial<UserProfileMetadata> = {}): UserProfileMetadata {
    return {
      userId: faker.string.uuid(),
      firstName: "Ada",
      lastName: "Lovelace",
      avatarUrl: "https://example.com/ada.png",
      ...overrides,
    };
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ContributorProfilesWarehouseRepository);
    databricksPort = testApp.module.get(DATABRICKS_PORT);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("merge", () => {
    it("writes every profile in one statement, updating the ones the copy has", async () => {
      const execute = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success(nothing));
      const ada = profile();
      const masked = profile({ firstName: "Unknown", lastName: "User", avatarUrl: null });

      assertSuccess(await repository.merge([ada, masked]));

      expect(execute).toHaveBeenCalledTimes(1);
      const [schema, statement, parameters] = execute.mock.calls[0];
      expect(schema).toBe(databricksPort.CENTRUM_SCHEMA_NAME);
      expect(statement).toContain("MERGE INTO contributor_profiles AS target");
      expect(statement).toContain("ON target.user_id = source.user_id");
      expect(statement).toContain("WHEN MATCHED THEN UPDATE SET");
      expect(statement).toContain("WHEN NOT MATCHED THEN INSERT");
      expect(parameters).toEqual([
        { name: "user_id_0", value: ada.userId },
        { name: "first_name_0", value: "Ada" },
        { name: "last_name_0", value: "Lovelace" },
        { name: "avatar_url_0", value: "https://example.com/ada.png" },
        { name: "user_id_1", value: masked.userId },
        { name: "first_name_1", value: "Unknown" },
        { name: "last_name_1", value: "User" },
        { name: "avatar_url_1", value: undefined },
      ]);
    });

    it("keeps every name a person typed out of the statement, as a parameter", async () => {
      const execute = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success(nothing));

      assertSuccess(
        await repository.merge([
          profile({ firstName: "O'Brien", lastName: "x'); DROP TABLE y; --" }),
        ]),
      );

      const [, statement] = execute.mock.calls[0];
      for (const value of ["O'Brien", "DROP TABLE"]) {
        expect(statement).not.toContain(value);
      }
    });

    it("sends nothing when there is nothing to write", async () => {
      const execute = vi.spyOn(databricksPort, "executeSqlQuery");

      assertSuccess(await repository.merge([]));

      expect(execute).not.toHaveBeenCalled();
    });

    it("fails when the warehouse refuses the statement", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Warehouse down")),
      );

      const result = await repository.merge([profile()]);

      assertFailure(result);
      expect(result.error.message).toBe("Failed to merge contributor profiles: Warehouse down");
    });
  });

  describe("delete", () => {
    it("deletes the copies by user id in one statement", async () => {
      const execute = vi
        .spyOn(databricksPort, "executeSqlQuery")
        .mockResolvedValue(success(nothing));
      const ids = [faker.string.uuid(), faker.string.uuid()];

      assertSuccess(await repository.delete(ids));

      const [, statement, parameters] = execute.mock.calls[0];
      expect(statement).toContain("DELETE FROM contributor_profiles");
      expect(statement).toContain("WHERE user_id IN (:user_id_0, :user_id_1)");
      expect(parameters).toEqual([
        { name: "user_id_0", value: ids[0] },
        { name: "user_id_1", value: ids[1] },
      ]);
    });

    it("sends nothing when nothing is gone", async () => {
      const execute = vi.spyOn(databricksPort, "executeSqlQuery");

      assertSuccess(await repository.delete([]));

      expect(execute).not.toHaveBeenCalled();
    });

    it("fails when the warehouse refuses the statement", async () => {
      vi.spyOn(databricksPort, "executeSqlQuery").mockResolvedValue(
        failure(AppError.internal("Warehouse down")),
      );

      const result = await repository.delete([faker.string.uuid()]);

      assertFailure(result);
      expect(result.error.message).toBe("Failed to delete contributor profiles: Warehouse down");
    });
  });
});
