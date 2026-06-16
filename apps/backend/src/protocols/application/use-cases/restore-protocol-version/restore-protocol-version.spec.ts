import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";
import { RestoreProtocolVersionUseCase } from "./restore-protocol-version";

describe("RestoreProtocolVersionUseCase", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let useCase: RestoreProtocolVersionUseCase;
  let protocolRepository: ProtocolRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(RestoreProtocolVersionUseCase);
    protocolRepository = testApp.module.get(ProtocolRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function createWithTwoVersions() {
    const created = await protocolRepository.create(
      { name: "P", code: [{ step: 1 }], family: "multispeq" },
      userId,
    );
    assertSuccess(created);
    const protocolId = created.value[0].id;
    const minted = await protocolRepository.mintVersion(protocolId, {
      code: [{ step: 2 }],
      family: "multispeq",
      createdBy: userId,
    });
    assertSuccess(minted);
    return protocolId;
  }

  it("forward-mints the historical code as a new head version", async () => {
    const protocolId = await createWithTwoVersions();

    const result = await useCase.execute(protocolId, 1, userId);
    assertSuccess(result);
    expect(result.value.latestVersion).toBe(3);
    expect(result.value.code).toEqual([{ step: 1 }]);
  });

  it("returns not found for a missing protocol", async () => {
    const result = await useCase.execute(faker.string.uuid(), 1, userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("forbids restoring a version on someone else's protocol", async () => {
    const protocolId = await createWithTwoVersions();
    const otherUser = await testApp.createTestUser({});

    const result = await useCase.execute(protocolId, 1, otherUser);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("returns not found for a missing version", async () => {
    const protocolId = await createWithTwoVersions();

    const result = await useCase.execute(protocolId, 99, userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("propagates a repository failure from the protocol lookup", async () => {
    vi.spyOn(protocolRepository, "findOne").mockResolvedValue(
      failure(AppError.internal("db down")),
    );

    const result = await useCase.execute(faker.string.uuid(), 1, userId);
    assertFailure(result);
  });

  it("propagates a repository failure from the version lookup", async () => {
    const protocolId = await createWithTwoVersions();
    vi.spyOn(protocolRepository, "findVersion").mockResolvedValue(
      failure(AppError.internal("db down")),
    );

    const result = await useCase.execute(protocolId, 1, userId);
    assertFailure(result);
  });
});
