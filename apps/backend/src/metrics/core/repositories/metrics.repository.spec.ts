import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { MetricsRepository } from "./metrics.repository";

describe("MetricsRepository", () => {
  const testApp = TestHarness.App;
  let repository: MetricsRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(MetricsRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("counts only registered users and reflects new registrations", async () => {
    const baseline = await repository.getRegistryCounts();
    assertSuccess(baseline);

    await testApp.createTestUser({ registered: true });
    await testApp.createTestUser({ registered: false });

    const result = await repository.getRegistryCounts();
    assertSuccess(result);

    expect(result.value.registeredUsers).toBe(baseline.value.registeredUsers + 1);
    // createTestUser provisions a personal organization per registered user.
    expect(result.value.organizations).toBeGreaterThanOrEqual(baseline.value.organizations);
    expect(result.value.experiments).toBe(baseline.value.experiments);
    expect(result.value.protocols).toBe(baseline.value.protocols);
    expect(result.value.macros).toBe(baseline.value.macros);
  });

  it("excludes deactivated and soft-deleted accounts", async () => {
    const baseline = await repository.getRegistryCounts();
    assertSuccess(baseline);

    await testApp.createTestUser({ registered: true, activated: false });
    await testApp.createTestUser({ registered: true, deletedAt: new Date() });

    const result = await repository.getRegistryCounts();
    assertSuccess(result);

    expect(result.value.registeredUsers).toBe(baseline.value.registeredUsers);
  });
});
