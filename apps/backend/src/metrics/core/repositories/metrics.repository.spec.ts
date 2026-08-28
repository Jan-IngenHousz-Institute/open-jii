import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { MetricsRepository } from "./metrics.repository";

describe("MetricsRepository", () => {
  const testApp = TestHarness.App;
  let repository: MetricsRepository;
  let userId: string;
  let organizationId: string;
  let orgExperimentId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(MetricsRepository);

    userId = await testApp.createTestUser({});
    organizationId = await testApp.createOrganization();
    await testApp.addOrganizationMember(organizationId, userId, "member");

    const { experiment } = await testApp.createExperiment({
      name: "Org experiment",
      userId,
      organizationId,
      visibility: "public",
    });
    orgExperimentId = experiment.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("maps experiments to their owning organization", async () => {
    const result = await repository.getExperimentOrganizations([orgExperimentId]);

    assertSuccess(result);
    expect(result.value).toEqual([{ experimentId: orgExperimentId, organizationId }]);
  });

  it("returns an empty mapping for an empty id list without querying", async () => {
    const result = await repository.getExperimentOrganizations([]);

    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("lists an organization's experiment ids", async () => {
    const result = await repository.getOrganizationExperimentIds(organizationId);

    assertSuccess(result);
    expect(result.value).toEqual([orgExperimentId]);
  });

  it("answers organization membership", async () => {
    const outsiderId = await testApp.createTestUser({});

    const member = await repository.isOrganizationMember(userId, organizationId);
    const outsider = await repository.isOrganizationMember(outsiderId, organizationId);

    assertSuccess(member);
    assertSuccess(outsider);
    expect(member.value).toBe(true);
    expect(outsider.value).toBe(false);
  });

  it("counts public experiments", async () => {
    const result = await repository.countPublicExperiments();

    assertSuccess(result);
    expect(result.value).toBe(1);
  });

  it("does not count a creator's own control grant as a shared experiment", async () => {
    const before = await repository.countSharedExperiments();
    assertSuccess(before);
    expect(before.value).toBe(0);

    const collaboratorId = await testApp.createTestUser({ email: "collab@example.com" });
    await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: orgExperimentId,
      granteeType: "user",
      granteeId: collaboratorId,
      role: "viewer",
      createdBy: userId,
    });

    const after = await repository.countSharedExperiments();
    assertSuccess(after);
    expect(after.value).toBe(1);
  });

  it("attributes created experiments to the user, without duplicates", async () => {
    const strangerId = await testApp.createTestUser({});

    const creator = await repository.getUserExperimentIds(userId);
    const stranger = await repository.getUserExperimentIds(strangerId);

    assertSuccess(creator);
    assertSuccess(stranger);
    expect(creator.value).toEqual([orgExperimentId]);
    expect(stranger.value).toEqual([]);
  });
});
