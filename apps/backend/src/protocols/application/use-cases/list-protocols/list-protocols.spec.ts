import { assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";
import { ListProtocolsUseCase } from "./list-protocols";

describe("ListProtocolsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListProtocolsUseCase;
  let protocolRepository: ProtocolRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListProtocolsUseCase);
    protocolRepository = testApp.module.get(ProtocolRepository);
  });

  afterEach(() => {
    testApp.afterEach();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should list all protocols without filter", async () => {
    // Arrange
    const protocol1 = {
      name: "Protocol 1",
      description: "Description 1",
      code: JSON.stringify({ steps: [{ name: "Step 1", action: "test" }] }),
    };

    const protocol2 = {
      name: "Protocol 2",
      description: "Description 2",
      code: JSON.stringify({ steps: [{ name: "Step 2", action: "test" }] }),
    };

    // Create test protocols
    await protocolRepository.create(protocol1, testUserId);
    await protocolRepository.create(protocol2, testUserId);

    // Act
    const result = await useCase.execute();

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const protocols = result.value;

    // Should find at least the two protocols we created
    expect(protocols.length).toBeGreaterThanOrEqual(2);
    expect(protocols.some((p) => p.name === protocol1.name)).toBe(true);
    expect(protocols.some((p) => p.name === protocol2.name)).toBe(true);
  });

  it("should filter protocols by search term", async () => {
    // Arrange
    const uniquePrefix = "UniqueTest";
    const protocol1 = {
      name: `${uniquePrefix} Protocol 1`,
      description: "Description 1",
      code: JSON.stringify({ steps: [{ name: "Step 1", action: "test" }] }),
    };

    const protocol2 = {
      name: "Different Protocol 2",
      description: "Description 2",
      code: JSON.stringify({ steps: [{ name: "Step 2", action: "test" }] }),
    };

    // Create test protocols
    await protocolRepository.create(protocol1, testUserId);
    await protocolRepository.create(protocol2, testUserId);

    // Act
    const result = await useCase.execute(uniquePrefix);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const protocols = result.value;

    // Should only find the protocol with the unique prefix
    expect(protocols.some((p) => p.name === protocol1.name)).toBe(true);
    expect(protocols.every((p) => p.name !== protocol2.name)).toBe(true);
  });

  it("should handle repository failures", async () => {
    // Arrange
    // Mock repository to fail
    jest.spyOn(protocolRepository, "findAll").mockResolvedValue(
      failure({
        name: "RepositoryError",
        code: "INTERNAL_ERROR",
        message: "Repository error",
        statusCode: 500,
      }),
    );

    // Act
    const result = await useCase.execute();

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error).toMatchObject({
      name: "RepositoryError",
      code: "INTERNAL_ERROR",
      message: "Repository error",
      statusCode: 500,
    });
  });
});
