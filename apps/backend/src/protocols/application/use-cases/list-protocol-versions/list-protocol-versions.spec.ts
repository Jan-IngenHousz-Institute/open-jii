import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";
import { UpdateProtocolUseCase } from "../update-protocol/update-protocol";
import { ListProtocolVersionsUseCase } from "./list-protocol-versions";

describe("ListProtocolVersionsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListProtocolVersionsUseCase;
  let updateUseCase: UpdateProtocolUseCase;
  let protocolRepository: ProtocolRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListProtocolVersionsUseCase);
    updateUseCase = testApp.module.get(UpdateProtocolUseCase);
    protocolRepository = testApp.module.get(ProtocolRepository);
  });

  afterEach(() => {
    testApp.afterEach();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return all versions of a protocol ordered by version descending", async () => {
    // Arrange
    const createResult = await protocolRepository.create(
      {
        name: "Versioned Protocol",
        description: "v1",
        code: JSON.stringify([{}]),
        family: "multispeq",
      },
      testUserId,
    );
    assertSuccess(createResult);
    const v1 = createResult.value[0];

    const v2Result = await updateUseCase.execute(v1.id, { description: "v2" });
    assertSuccess(v2Result);

    const v3Result = await updateUseCase.execute(v2Result.value.id, { description: "v3" });
    assertSuccess(v3Result);

    // Act
    const result = await useCase.execute(v1.id);

    // Assert
    assertSuccess(result);
    expect(result.value).toHaveLength(3);
    expect(result.value[0].version).toBe(3);
    expect(result.value[1].version).toBe(2);
    expect(result.value[2].version).toBe(1);

    // All share the same name
    expect(result.value.every((v) => v.name === "Versioned Protocol")).toBe(true);
  });

  it("should return single version for a protocol with no updates", async () => {
    // Arrange
    const createResult = await protocolRepository.create(
      {
        name: "Single Version Protocol",
        description: "Only v1",
        code: JSON.stringify([{}]),
        family: "multispeq",
      },
      testUserId,
    );
    assertSuccess(createResult);
    const v1 = createResult.value[0];

    // Act
    const result = await useCase.execute(v1.id);

    // Assert
    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].version).toBe(1);
    expect(result.value[0].id).toBe(v1.id);
  });

  it("should return not found for non-existent protocol", async () => {
    const result = await useCase.execute(faker.string.uuid());

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("should not mix versions from different protocols", async () => {
    // Arrange — two different protocols
    const resultA = await protocolRepository.create(
      { name: "Protocol A", code: JSON.stringify([{}]), family: "multispeq" },
      testUserId,
    );
    assertSuccess(resultA);

    const resultB = await protocolRepository.create(
      { name: "Protocol B", code: JSON.stringify([{}]), family: "ambit" },
      testUserId,
    );
    assertSuccess(resultB);

    // Update Protocol A
    await updateUseCase.execute(resultA.value[0].id, { description: "A v2" });

    // Act — list versions of Protocol A
    const versionsA = await useCase.execute(resultA.value[0].id);
    assertSuccess(versionsA);

    // Assert
    expect(versionsA.value).toHaveLength(2);
    expect(versionsA.value.every((v) => v.name === "Protocol A")).toBe(true);
  });
});
