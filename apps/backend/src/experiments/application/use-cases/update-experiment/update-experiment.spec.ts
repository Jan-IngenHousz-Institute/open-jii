import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { UpdateExperimentUseCase } from "./update-experiment";

describe("UpdateExperimentUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateExperimentUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateExperimentUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should update an experiment with valid data", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Original Experiment Name",
      description: "Original description",
      status: "stale",
      visibility: "private",
      userId: testUserId,
    });

    // Define update data. `visibility: "public"` is included to prove the
    // back door is closed: the update path must ignore it — publishing is
    // only possible through the dedicated `setVisibility` route.
    const updateData = {
      name: "Updated Experiment Name",
      description: "Updated description",
      status: "active" as const,
      visibility: "public" as const,
    };

    // Execute the update
    const result = await useCase.execute(experiment.id, updateData);

    // Verify result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const updatedExperiment = result.value;

    // Verify content fields were updated but visibility was NOT flipped.
    expect(updatedExperiment).toMatchObject({
      id: experiment.id,
      name: updateData.name,
      description: updateData.description,
      status: updateData.status,
      visibility: "private",
      createdBy: testUserId,
    });
  });

  it("ignores a visibility change on the update path", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Back Door",
      visibility: "public",
      userId: testUserId,
    });

    // Attempting public → private alongside a legitimate content edit: the
    // content change applies, but visibility is stripped and stays public.
    const result = await useCase.execute(experiment.id, {
      name: "Renamed",
      visibility: "private",
    });

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.name).toBe("Renamed");
    expect(result.value.visibility).toBe("public");
  });

  it("allows changing the embargo date while the experiment is private", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Embargo Private",
      visibility: "private",
      userId: testUserId,
    });

    const embargoUntil = new Date("2999-01-01T00:00:00.000Z");
    const result = await useCase.execute(experiment.id, { embargoUntil });

    expect(result.isSuccess()).toBe(true);
  });

  it("rejects changing the embargo date once the experiment is public", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Embargo Public",
      visibility: "public",
      userId: testUserId,
    });

    const embargoUntil = new Date("2999-01-01T00:00:00.000Z");
    const result = await useCase.execute(experiment.id, { embargoUntil });

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("EMBARGO_NOT_EDITABLE_WHEN_PUBLIC");
  });

  it("should update only specified fields", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Original Name",
      description: "Original description",
      status: "active",
      visibility: "private",
      userId: testUserId,
    });

    // Update only the name field
    const partialUpdate = {
      name: "Updated Name Only",
    };

    const result = await useCase.execute(experiment.id, partialUpdate);

    // Verify result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const updatedExperiment = result.value;

    // Verify only the name was updated but other fields remain the same
    expect(updatedExperiment).toMatchObject({
      id: experiment.id,
      name: partialUpdate.name,
      description: experiment.description,
      status: experiment.status,
      visibility: experiment.visibility,
      createdBy: testUserId,
    });
  });

  it("should return NOT_FOUND error if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const updateData = { name: "Won't Update" };

    const result = await useCase.execute(nonExistentId, updateData);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain(`Experiment with ID ${nonExistentId} not found`);
  });

  it("should allow archiving an active experiment", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Archive Allowed",
      userId: testUserId,
    });

    const updateData = { status: "archived" as const };
    const result = await useCase.execute(experiment.id, updateData);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.status).toBe("archived");
  });

  it("should allow updating only the status of an archived experiment", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Archived Admin Update",
      userId: testUserId,
    });

    // Archive
    await useCase.execute(experiment.id, { status: "archived" as const });

    // Try updating non-status field (should fail)
    const forbiddenResult = await useCase.execute(experiment.id, { name: "Not Allowed" });
    expect(forbiddenResult.isSuccess()).toBe(false);
    assertFailure(forbiddenResult);
    expect(forbiddenResult.error.code).toBe("FORBIDDEN");
    expect(forbiddenResult.error.message).toContain(
      "Only the status field can be updated on archived experiments",
    );

    // Now test valid status update
    const reopenResult = await useCase.execute(experiment.id, { status: "active" as const });
    expect(reopenResult.isSuccess()).toBe(true);
    assertSuccess(reopenResult);
    expect(reopenResult.value.status).toBe("active");
  });
});
