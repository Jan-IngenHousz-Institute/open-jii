import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";
import { DuplicateProtocolUseCase } from "./duplicate-protocol";

describe("DuplicateProtocolUseCase", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let useCase: DuplicateProtocolUseCase;
  let protocolRepository: ProtocolRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(DuplicateProtocolUseCase);
    protocolRepository = testApp.module.get(ProtocolRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function createSource(name: string) {
    const result = await protocolRepository.create(
      { name, description: "src", code: [{ step: 1 }], family: "multispeq" },
      userId,
    );
    assertSuccess(result);
    return result.value[0];
  }

  it("duplicates a protocol into a fresh copy seeded from the source", async () => {
    const source = await createSource("Original");

    const result = await useCase.execute(source.id, userId);
    assertSuccess(result);
    expect(result.value.id).not.toBe(source.id);
    expect(result.value.name).toBe("Copy of Original");
    expect(result.value.code).toEqual(source.code);
    expect(result.value.family).toBe(source.family);
    expect(result.value.createdBy).toBe(userId);
  });

  it("uses the provided name override", async () => {
    const source = await createSource("Original");

    const result = await useCase.execute(source.id, userId, "My Custom Copy");
    assertSuccess(result);
    expect(result.value.name).toBe("My Custom Copy");
  });

  it("disambiguates the name when the target already exists", async () => {
    const source = await createSource("Original");

    const first = await useCase.execute(source.id, userId);
    assertSuccess(first);
    expect(first.value.name).toBe("Copy of Original");

    const second = await useCase.execute(source.id, userId);
    assertSuccess(second);
    expect(second.value.name).toBe("Copy of Original (2)");
  });

  it("returns not found for a non-existent protocol", async () => {
    const result = await useCase.execute(faker.string.uuid(), userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
