import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { JOIN_CODE_ALPHABET } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";
import { and, eq, experimentJoinCodes, isNull } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentJoinCodeRepository } from "../../../core/repositories/experiment-join-code.repository";
import { CreateJoinCodeUseCase } from "./create-join-code";
import { RevokeJoinCodeUseCase } from "./revoke-join-code";

const CODE_PATTERN = new RegExp(`^[${JOIN_CODE_ALPHABET}]{8}$`);

describe("CreateJoinCodeUseCase", () => {
  const testApp = TestHarness.App;
  let createUseCase: CreateJoinCodeUseCase;
  let joinCodeRepository: ExperimentJoinCodeRepository;
  let organizerId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    organizerId = await testApp.createTestUser({ email: "organizer@example.com" });
    createUseCase = testApp.module.get(CreateJoinCodeUseCase);
    joinCodeRepository = testApp.module.get(ExperimentJoinCodeRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function seedExperiment(
    overrides: { status?: "active" | "archived"; visibility?: "public" | "private" } = {},
  ) {
    const { experiment } = await testApp.createExperiment({
      name: `Join code ${faker.string.uuid()}`,
      userId: organizerId,
      visibility: overrides.visibility ?? "public",
      status: overrides.status ?? "active",
    });
    return experiment;
  }

  function rowsFor(experimentId: string) {
    return testApp.database
      .select()
      .from(experimentJoinCodes)
      .where(eq(experimentJoinCodes.experimentId, experimentId));
  }

  function activeRowsFor(experimentId: string) {
    return testApp.database
      .select()
      .from(experimentJoinCodes)
      .where(
        and(
          eq(experimentJoinCodes.experimentId, experimentId),
          isNull(experimentJoinCodes.revokedAt),
        ),
      );
  }

  it("mints a code from the alphabet, authored by the organizer", async () => {
    const experiment = await seedExperiment();

    const result = await createUseCase.execute(experiment.id, organizerId, "7d");

    assertSuccess(result);
    expect(result.value.code).toMatch(CODE_PATTERN);
    expect(result.value.createdBy).toBe(organizerId);
    expect(result.value.redemptionCount).toBe(0);
    expect(result.value.revokedAt).toBeNull();
  });

  it.each([
    ["1d", 1],
    ["7d", 7],
    ["30d", 30],
  ] as const)("lands %s as an expiry %i days out", async (preset, days) => {
    const experiment = await seedExperiment();
    const before = Date.now();

    const result = await createUseCase.execute(experiment.id, organizerId, preset);

    assertSuccess(result);
    const expiresAt = result.value.expiresAt;
    if (!expiresAt) throw new Error("Expected an expiry");
    const offsetDays = (expiresAt.getTime() - before) / (24 * 60 * 60 * 1000);
    // A wide band: the assertion is which preset landed, not the clock.
    expect(offsetDays).toBeGreaterThan(days - 0.01);
    expect(offsetDays).toBeLessThan(days + 0.01);
  });

  it("leaves expiry null for `never`", async () => {
    const experiment = await seedExperiment();

    const result = await createUseCase.execute(experiment.id, organizerId, "never");

    assertSuccess(result);
    expect(result.value.expiresAt).toBeNull();
  });

  it("revokes the previous code, so exactly one row stays active", async () => {
    const experiment = await seedExperiment();
    const first = await createUseCase.execute(experiment.id, organizerId, "7d");
    assertSuccess(first);

    const second = await createUseCase.execute(experiment.id, organizerId, "1d");

    assertSuccess(second);
    expect(second.value.code).not.toBe(first.value.code);

    const active = await activeRowsFor(experiment.id);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(second.value.id);

    // The old row is kept, revoked: the audit has to stay answerable.
    const all = await rowsFor(experiment.id);
    expect(all).toHaveLength(2);
    const previous = all.find((row) => row.id === first.value.id);
    expect(previous?.revokedAt).not.toBeNull();
  });

  it("replaces an expired row that was never revoked", async () => {
    const experiment = await seedExperiment();
    const first = await createUseCase.execute(experiment.id, organizerId, "1d");
    assertSuccess(first);
    // Expired but still occupying the one-active-code index.
    await testApp.database
      .update(experimentJoinCodes)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(experimentJoinCodes.id, first.value.id));

    const second = await createUseCase.execute(experiment.id, organizerId, "7d");

    assertSuccess(second);
    expect(await activeRowsFor(experiment.id)).toHaveLength(1);
  });

  it("refuses an archived experiment", async () => {
    const experiment = await seedExperiment({ status: "archived" });

    const result = await createUseCase.execute(experiment.id, organizerId, "7d");

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(result.error.message).toContain("archived");
    expect(await rowsFor(experiment.id)).toHaveLength(0);
  });

  it("refuses a private experiment", async () => {
    const experiment = await seedExperiment({ visibility: "private" });

    const result = await createUseCase.execute(experiment.id, organizerId, "7d");

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(result.error.message).toContain("public");
    expect(await rowsFor(experiment.id)).toHaveLength(0);
  });

  it("returns not found for an experiment that does not exist", async () => {
    const result = await createUseCase.execute(faker.string.uuid(), organizerId, "7d");

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.NOT_FOUND);
  });

  it("redraws when the generated code collides, leaving the other experiment's code intact", async () => {
    const other = await seedExperiment();
    const taken = await createUseCase.execute(other.id, organizerId, "7d");
    assertSuccess(taken);
    const experiment = await seedExperiment();

    // First draw collides with a code another experiment already holds.
    const generate = vi.spyOn(joinCodeRepository, "generateCode");
    generate.mockReturnValueOnce(taken.value.code);

    const result = await createUseCase.execute(experiment.id, organizerId, "7d");

    assertSuccess(result);
    expect(result.value.code).not.toBe(taken.value.code);
    expect(generate).toHaveBeenCalledTimes(2);

    // The collision must not have taken the other experiment's code down with it.
    const otherRows = await activeRowsFor(other.id);
    expect(otherRows).toHaveLength(1);
    expect(otherRows[0].code).toBe(taken.value.code);
  });

  it("gives up after three collisions rather than looping", async () => {
    const other = await seedExperiment();
    const taken = await createUseCase.execute(other.id, organizerId, "7d");
    assertSuccess(taken);
    const experiment = await seedExperiment();
    const generate = vi.spyOn(joinCodeRepository, "generateCode").mockReturnValue(taken.value.code);

    const result = await createUseCase.execute(experiment.id, organizerId, "7d");

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(generate).toHaveBeenCalledTimes(3);
    // Every attempt rolled back whole: the previous code survived, this one wrote nothing.
    expect(await activeRowsFor(other.id)).toHaveLength(1);
    expect(await rowsFor(experiment.id)).toHaveLength(0);
  });
});

describe("RevokeJoinCodeUseCase", () => {
  const testApp = TestHarness.App;
  let createUseCase: CreateJoinCodeUseCase;
  let revokeUseCase: RevokeJoinCodeUseCase;
  let organizerId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    organizerId = await testApp.createTestUser({ email: "revoker@example.com" });
    createUseCase = testApp.module.get(CreateJoinCodeUseCase);
    revokeUseCase = testApp.module.get(RevokeJoinCodeUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("revokes the active code and is idempotent", async () => {
    const { experiment } = await testApp.createExperiment({
      name: `Revoke ${faker.string.uuid()}`,
      userId: organizerId,
      visibility: "public",
    });
    const created = await createUseCase.execute(experiment.id, organizerId, "7d");
    assertSuccess(created);

    assertSuccess(await revokeUseCase.execute(experiment.id));
    // Revoking again with nothing active is a success, not an error.
    assertSuccess(await revokeUseCase.execute(experiment.id));

    const rows = await testApp.database
      .select()
      .from(experimentJoinCodes)
      .where(eq(experimentJoinCodes.experimentId, experiment.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].revokedAt).not.toBeNull();
  });

  it("succeeds when the experiment never had a code", async () => {
    const { experiment } = await testApp.createExperiment({
      name: `Revoke empty ${faker.string.uuid()}`,
      userId: organizerId,
      visibility: "public",
    });

    assertSuccess(await revokeUseCase.execute(experiment.id));
  });

  it("returns not found for an experiment that does not exist", async () => {
    const result = await revokeUseCase.execute(faker.string.uuid());

    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.NOT_FOUND);
  });
});
