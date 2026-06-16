import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";
import { GetProtocolUseCase } from "./get-protocol";

describe("GetProtocolUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetProtocolUseCase;
  let protocolRepository: ProtocolRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetProtocolUseCase);
    protocolRepository = testApp.module.get(ProtocolRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should retrieve a protocol by id", async () => {
    // Arrange
    const protocolData = {
      name: "Test Protocol",
      description: "A test protocol description",
      code: { steps: [{ name: "Step 1", action: "test" }] },
      family: "multispeq" as const,
    };

    // Create a protocol to retrieve
    const createResult = await protocolRepository.create(protocolData, testUserId);
    assertSuccess(createResult);
    const createdProtocol = createResult.value[0];

    // Act
    const result = await useCase.execute(createdProtocol.id);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const protocol = result.value;

    // Verify all fields were retrieved correctly
    expect(protocol).toMatchObject({
      id: createdProtocol.id,
      name: protocolData.name,
      description: protocolData.description,
      code: protocolData.code,
      createdBy: testUserId,
    });
  });

  it("should return not found error for non-existent protocol", async () => {
    // Act
    const result = await useCase.execute(faker.string.uuid());

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Protocol not found",
      statusCode: 404,
    });
  });

  it("returns a pinned version's code when a non-latest version is requested", async () => {
    const created = await protocolRepository.create(
      { name: "Versioned Protocol", code: [{ step: 1 }], family: "multispeq" },
      testUserId,
    );
    assertSuccess(created);
    const protocolId = created.value[0].id;
    const minted = await protocolRepository.mintVersion(protocolId, {
      code: [{ step: 2 }],
      family: "multispeq",
      createdBy: testUserId,
    });
    assertSuccess(minted);

    const result = await useCase.execute(protocolId, 1);
    assertSuccess(result);
    expect(result.value.code).toEqual([{ step: 1 }]);
  });

  it("returns not found when a pinned protocol version does not exist", async () => {
    const created = await protocolRepository.create(
      { name: "Versioned Protocol 2", code: [{ step: 1 }], family: "multispeq" },
      testUserId,
    );
    assertSuccess(created);

    const result = await useCase.execute(created.value[0].id, 99);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
