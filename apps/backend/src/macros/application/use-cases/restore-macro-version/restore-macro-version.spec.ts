import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { RestoreMacroVersionUseCase } from "./restore-macro-version";

describe("RestoreMacroVersionUseCase", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let useCase: RestoreMacroVersionUseCase;
  let macroRepository: MacroRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(RestoreMacroVersionUseCase);
    macroRepository = testApp.module.get(MacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function createWithTwoVersions() {
    const created = await macroRepository.create(
      { name: "M", language: "python", code: "djE=" },
      userId,
    );
    assertSuccess(created);
    const macroId = created.value[0].id;
    const minted = await macroRepository.mintVersion(macroId, {
      code: "djI=",
      language: "python",
      createdBy: userId,
    });
    assertSuccess(minted);
    return macroId;
  }

  it("forward-mints the historical code as a new head version", async () => {
    const macroId = await createWithTwoVersions();

    const result = await useCase.execute(macroId, 1, userId);
    assertSuccess(result);
    expect(result.value.latestVersion).toBe(3);
    expect(result.value.code).toBe("djE=");
  });

  it("returns not found for a missing macro", async () => {
    const result = await useCase.execute(faker.string.uuid(), 1, userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("forbids restoring a version on someone else's macro", async () => {
    const macroId = await createWithTwoVersions();
    const otherUser = await testApp.createTestUser({});

    const result = await useCase.execute(macroId, 1, otherUser);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("returns not found for a missing version", async () => {
    const macroId = await createWithTwoVersions();

    const result = await useCase.execute(macroId, 99, userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("propagates a repository failure from the macro lookup", async () => {
    vi.spyOn(macroRepository, "findById").mockResolvedValue(failure(AppError.internal("db down")));

    const result = await useCase.execute(faker.string.uuid(), 1, userId);
    assertFailure(result);
  });

  it("propagates a repository failure from the version lookup", async () => {
    const macroId = await createWithTwoVersions();
    vi.spyOn(macroRepository, "findVersion").mockResolvedValue(
      failure(AppError.internal("db down")),
    );

    const result = await useCase.execute(macroId, 1, userId);
    assertFailure(result);
  });
});
