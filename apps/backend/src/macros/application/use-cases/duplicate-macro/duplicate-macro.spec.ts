import { faker } from "@faker-js/faker";

import {
  assertFailure,
  assertSuccess,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { DuplicateMacroUseCase } from "./duplicate-macro";

describe("DuplicateMacroUseCase", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let useCase: DuplicateMacroUseCase;
  let macroRepository: MacroRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(DuplicateMacroUseCase);
    macroRepository = testApp.module.get(MacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function createSource(name: string) {
    const result = await macroRepository.create(
      { name, description: "src", language: "python", code: "cHJpbnQoMSk=" },
      userId,
    );
    assertSuccess(result);
    return result.value[0];
  }

  it("duplicates a macro into a fresh copy seeded from the source", async () => {
    const source = await createSource("Original");

    const result = await useCase.execute(source.id, userId);
    assertSuccess(result);
    expect(result.value.id).not.toBe(source.id);
    expect(result.value.name).toBe("Copy of Original");
    expect(result.value.code).toBe(source.code);
    expect(result.value.language).toBe(source.language);
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

  it("returns not found for a non-existent macro", async () => {
    const result = await useCase.execute(faker.string.uuid(), userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("retries when create hits a unique-constraint violation, then succeeds", async () => {
    const source = await createSource("Original");
    const fork = { ...source, id: faker.string.uuid(), name: "Copy of Original" };
    vi.spyOn(macroRepository, "create")
      .mockResolvedValueOnce(failure(AppError.conflict("dup", "REPOSITORY_DUPLICATE")))
      .mockResolvedValueOnce(success([fork]));

    const result = await useCase.execute(source.id, userId);
    assertSuccess(result);
    expect(macroRepository.create).toHaveBeenCalledTimes(2);
  });

  it("fails after exhausting retries on persistent conflicts", async () => {
    const source = await createSource("Original");
    vi.spyOn(macroRepository, "create").mockResolvedValue(
      failure(AppError.conflict("dup", "REPOSITORY_DUPLICATE")),
    );

    const result = await useCase.execute(source.id, userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(409);
  });
});
