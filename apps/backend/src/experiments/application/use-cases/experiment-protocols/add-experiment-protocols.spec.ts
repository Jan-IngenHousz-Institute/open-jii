import { protocols } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { ExperimentProtocolDto } from "../../../core/models/experiment-protocols.model";
import { AddExperimentProtocolsUseCase } from "./add-experiment-protocols";

describe("AddExperimentProtocolsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: AddExperimentProtocolsUseCase;
  let protocol1Id: string;
  let protocol2Id: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(AddExperimentProtocolsUseCase);
    // Create two protocols
    [protocol1Id, protocol2Id] = await Promise.all([
      testApp.database
        .insert(protocols)
        .values({
          name: "Protocol 1",
          code: {},
          family: "multispeq",
          createdBy: testUserId,
        })
        .returning()
        .then((rows) => rows[0].id),
      testApp.database
        .insert(protocols)
        .values({
          name: "Protocol 2",
          code: {},
          family: "ambit",
          createdBy: testUserId,
        })
        .returning()
        .then((rows) => rows[0].id),
    ]);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should add multiple protocols to an experiment", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Add Protocols Test Experiment",
      userId: testUserId,
    });

    // Add the protocols through the use case
    const result = await useCase.execute(
      experiment.id,
      [
        { protocolId: protocol1Id, order: 0 },
        { protocolId: protocol2Id, order: 1 },
      ],
      testUserId,
    );

    // Verify result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    const protocols = result.value;
    expect(Array.isArray(protocols)).toBe(true);
    expect(protocols.length).toBe(2);

    expect(protocols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          order: 0,
          protocol: expect.objectContaining({
            id: protocol1Id,
            name: "Protocol 1",
          }) as Partial<ExperimentProtocolDto>,
        }),
        expect.objectContaining({
          order: 1,
          protocol: expect.objectContaining({
            id: protocol2Id,
            name: "Protocol 2",
          }) as Partial<ExperimentProtocolDto>,
        }),
      ]),
    );
  });

  it("should return NOT_FOUND error if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const result = await useCase.execute(
      nonExistentId,
      [{ protocolId: protocol1Id, order: 0 }],
      testUserId,
    );
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return FORBIDDEN error if user is not an admin", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Forbidden Protocol Test Experiment",
      userId: testUserId,
    });

    // Create a non-admin user
    const nonAdminId = await testApp.createTestUser({
      email: "nonadmin-protocol@example.com",
    });

    // Try to add protocols as a non-admin user
    const result = await useCase.execute(
      experiment.id,
      [{ protocolId: protocol1Id, order: 0 }],
      nonAdminId,
    );

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("should return FORBIDDEN when attempting to add protocols to an archived experiment", async () => {
    // Create an experiment and archive it
    const { experiment } = await testApp.createExperiment({
      name: "Archived Protocols Test",
      userId: testUserId,
      status: "archived",
    });

    const result = await useCase.execute(
      experiment.id,
      [{ protocolId: protocol1Id, order: 0 }],
      testUserId,
    );

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });
});
