import { StatusCodes } from "http-status-codes";

import { eq, resourceGrants } from "@repo/database";

import { assertFailure } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { UpdateGrantUseCase } from "./update-grant";

describe("updateGrant", () => {
  const testApp = TestHarness.App;
  let updateGrant: UpdateGrantUseCase;
  let owner: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    updateGrant = testApp.module.get(UpdateGrantUseCase);
    owner = await testApp.createTestUser({ name: "Owner" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns 404 for a grant id belonging to a different resource", async () => {
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
    // resource scoping in the update itself stops this editing the wrong row.
    const elsewhere = await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: other.experiment.id,
      granteeType: "user",
      granteeId: collaborator,
      role: "viewer",
      createdBy: owner,
    });

    const updated = await updateGrant.execute(owner, "experiment", experiment.id, elsewhere.id, {
      role: "admin",
    });
    assertFailure(updated);
    expect(updated.error.statusCode).toBe(StatusCodes.NOT_FOUND);

    const [untouched] = await testApp.database
      .select()
      .from(resourceGrants)
      .where(eq(resourceGrants.id, elsewhere.id));
    expect(untouched.role).toBe("viewer");
  });
});
