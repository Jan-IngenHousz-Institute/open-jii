import { StatusCodes } from "http-status-codes";

import { and, eq, resourceGrants } from "@repo/database";

import { assertFailure, assertSuccess } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { CreateGrantUseCase } from "./create-grant";
import { ListGrantsUseCase } from "./list-grants";
import { RevokeGrantUseCase } from "./revoke-grant";

describe("revokeGrant", () => {
  const testApp = TestHarness.App;
  let createGrant: CreateGrantUseCase;
  let listGrants: ListGrantsUseCase;
  let revokeGrant: RevokeGrantUseCase;
  let owner: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    createGrant = testApp.module.get(CreateGrantUseCase);
    listGrants = testApp.module.get(ListGrantsUseCase);
    revokeGrant = testApp.module.get(RevokeGrantUseCase);
    owner = await testApp.createTestUser({ name: "Owner" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns 404 for a grant id belonging to a different resource, and leaves it alone", async () => {
    const { experiment } = await testApp.createExperiment({
      name: `Exp ${crypto.randomUUID()}`,
      userId: owner,
    });
    const other = await testApp.createExperiment({
      name: `Other ${crypto.randomUUID()}`,
      userId: owner,
    });
    const collaborator = await testApp.createTestUser({ name: "Collaborator" });
    // The grant lives on `other`, and the caller administers both — so only the
    // resource scoping in the delete itself stops this revoking the wrong row.
    const elsewhere = await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: other.experiment.id,
      granteeType: "user",
      granteeId: collaborator,
      role: "viewer",
      createdBy: owner,
    });

    const revoked = await revokeGrant.execute(owner, "experiment", experiment.id, elsewhere.id);
    assertFailure(revoked);
    expect(revoked.error.statusCode).toBe(StatusCodes.NOT_FOUND);

    const stillThere = await testApp.database
      .select()
      .from(resourceGrants)
      .where(eq(resourceGrants.id, elsewhere.id));
    expect(stillThere).toHaveLength(1);
  });

  it("deletes a grant and returns success", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    const outsider = await testApp.createTestUser({ name: "Outsider" });
    assertSuccess(
      await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "user",
        granteeId: outsider,
        role: "viewer",
      }),
    );
    const [grant] = await testApp.database
      .select()
      .from(resourceGrants)
      .where(
        and(
          eq(resourceGrants.resourceType, "macro"),
          eq(resourceGrants.resourceId, macro.id),
          eq(resourceGrants.granteeId, outsider),
        ),
      );

    assertSuccess(await revokeGrant.execute(owner, "macro", macro.id, grant.id));
    const after = await listGrants.execute(owner, "macro", macro.id);
    assertSuccess(after);
    // Only the creator's own grant is left.
    expect(after.value.map((grant) => grant.granteeId)).toEqual([owner]);
  });

  // An archived experiment is immutable everywhere else — the read-only row controls
  // are not the enforcement, the server is.
  it("refuses a revoke on an archived experiment, keeping the grant", async () => {
    const { experiment } = await testApp.createExperiment({
      name: `Exp ${crypto.randomUUID()}`,
      userId: owner,
      status: "archived",
    });
    const collaborator = await testApp.createTestUser({ name: "Collaborator" });
    const grant = await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: collaborator,
      role: "viewer",
      createdBy: owner,
    });

    const revoked = await revokeGrant.execute(owner, "experiment", experiment.id, grant.id);

    assertFailure(revoked);
    expect(revoked.error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(revoked.error.message).toBe("Cannot modify an archived experiment");
    expect(
      await testApp.database.select().from(resourceGrants).where(eq(resourceGrants.id, grant.id)),
    ).toHaveLength(1);
  });
});
