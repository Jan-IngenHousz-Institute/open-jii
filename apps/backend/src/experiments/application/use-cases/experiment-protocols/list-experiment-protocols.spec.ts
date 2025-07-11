import { assertFailure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { ExperimentProtocolDto } from "../../../core/models/experiment-protocols.model";
import { ListExperimentProtocolsUseCase } from "./list-experiment-protocols";

describe("ListExperimentProtocolsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListExperimentProtocolsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListExperimentProtocolsUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should list protocols of an experiment", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "List Protocols Test Experiment",
      userId: testUserId,
    });

    // Create and add protocols
    const protocol1 = await testApp.createProtocol({
      name: "Protocol 1",
      createdBy: testUserId,
    });
    const protocol2 = await testApp.createProtocol({
      name: "Protocol 2",
      createdBy: testUserId,
    });
    await testApp.addExperimentProtocol(experiment.id, protocol1.id, 0);
    await testApp.addExperimentProtocol(experiment.id, protocol2.id, 1);

    // List protocols
    const result = await useCase.execute(experiment.id, testUserId);

    expect(result.isSuccess()).toBe(true);
    const protocols = result._tag === "success" ? result.value : [];
    expect(protocols).toHaveLength(2);
    // Check that both protocols are present by id and name, using objectContaining for flexibility
    expect(protocols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          protocol: expect.objectContaining({
            id: protocol1.id,
            name: protocol1.name,
          }) as Partial<ExperimentProtocolDto>,
        }),
        expect.objectContaining({
          protocol: expect.objectContaining({
            id: protocol2.id,
            name: protocol2.name,
          }) as Partial<ExperimentProtocolDto>,
        }),
      ]),
    );
  });

  it("should return NOT_FOUND error if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const result = await useCase.execute(nonExistentId, testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return FORBIDDEN error if user has no access to private experiment", async () => {
    // Create a private experiment
    const { experiment } = await testApp.createExperiment({
      name: "Private Experiment",
      visibility: "private",
      userId: testUserId,
    });

    // Create a user who is not a member
    const nonMemberId = await testApp.createTestUser({
      email: "nonmember@example.com",
    });

    // Try to list protocols as non-member
    const result = await useCase.execute(experiment.id, nonMemberId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("should allow any user to list protocols of a public experiment", async () => {
    // Create a public experiment
    const { experiment } = await testApp.createExperiment({
      name: "Public Experiment",
      visibility: "public",
      userId: testUserId,
    });

    // Create and add a protocol
    const protocol = await testApp.createProtocol({
      name: "Public Protocol",
      createdBy: testUserId,
    });
    await testApp.addExperimentProtocol(experiment.id, protocol.id, 0);

    // Create a user who is not a member
    const nonMemberId = await testApp.createTestUser({
      email: "nonmember@example.com",
    });

    // List protocols as non-member
    const result = await useCase.execute(experiment.id, nonMemberId);
    expect(result.isSuccess()).toBe(true);
    const protocols = result._tag === "success" ? result.value : [];
    expect(protocols).toHaveLength(1);
    expect(protocols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          protocol: expect.objectContaining({
            id: protocol.id,
            name: protocol.name,
          }) as Partial<ExperimentProtocolDto>,
        }),
      ]),
    );
  });
});
