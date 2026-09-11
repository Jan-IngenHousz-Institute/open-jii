import { eq, experiments, workbookVersions } from "@repo/database";

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

  it("does not count a grant to the experiment's own organization as sharing", async () => {
    await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: orgExperimentId,
      granteeType: "organization",
      granteeId: organizationId,
      role: "viewer",
      createdBy: userId,
    });

    const ownOrg = await repository.countSharedExperiments();
    assertSuccess(ownOrg);
    expect(ownOrg.value).toBe(0);

    const otherOrganizationId = await testApp.createOrganization();
    await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: orgExperimentId,
      granteeType: "organization",
      granteeId: otherOrganizationId,
      role: "viewer",
      createdBy: userId,
    });

    const otherOrg = await repository.countSharedExperiments();
    assertSuccess(otherOrg);
    expect(otherOrg.value).toBe(1);
  });

  it("attributes experiments held through a direct grant to the user", async () => {
    const granteeId = await testApp.createTestUser({ email: "grantee@example.com" });
    await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: orgExperimentId,
      granteeType: "user",
      granteeId,
      role: "viewer",
      createdBy: userId,
    });

    const result = await repository.getUserExperimentIds(granteeId);

    assertSuccess(result);
    expect(result.value).toEqual([orgExperimentId]);
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
  it("lists the protocols, macros and workbooks a reader may see", async () => {
    const outsiderId = await testApp.createTestUser({});

    const visibleProtocol = await testApp.createProtocol({
      name: "Public protocol",
      createdBy: outsiderId,
      visibility: "public",
    });
    await testApp.createProtocol({
      name: "Private protocol",
      createdBy: outsiderId,
      visibility: "private",
    });
    const visibleMacro = await testApp.createMacro({
      name: "Public macro",
      createdBy: outsiderId,
      visibility: "public",
    });
    const visibleWorkbook = await testApp.createWorkbook({
      name: "Public workbook",
      createdBy: outsiderId,
      visibility: "public",
    });

    const protocolIds = await repository.getVisibleProtocolIds(userId);
    const macroIds = await repository.getVisibleMacroIds(userId);
    const workbookIds = await repository.getVisibleWorkbookIds(userId);

    assertSuccess(protocolIds);
    assertSuccess(macroIds);
    assertSuccess(workbookIds);
    expect(protocolIds.value).toEqual([visibleProtocol.id]);
    expect(macroIds.value).toEqual([visibleMacro.id]);
    expect(workbookIds.value).toEqual([visibleWorkbook.id]);
  });

  it("leaves archived experiments out, as the list page does", async () => {
    const { experiment: archived } = await testApp.createExperiment({
      name: "Finished experiment",
      userId,
      organizationId,
      visibility: "public",
    });
    await testApp.database
      .update(experiments)
      .set({ status: "archived" })
      .where(eq(experiments.id, archived.id));

    const result = await repository.getVisibleExperimentIds(userId);

    assertSuccess(result);
    expect(result.value).toEqual([orgExperimentId]);
  });

  it("lists the experiments a reader may see, and no others", async () => {
    const outsiderId = await testApp.createTestUser({});
    await testApp.createExperiment({
      name: "Someone else's private experiment",
      userId: outsiderId,
      visibility: "private",
    });

    const result = await repository.getVisibleExperimentIds(userId);

    assertSuccess(result);
    expect(result.value).toEqual([orgExperimentId]);
  });

  it("folds workbook versions back onto the workbooks that own them", async () => {
    const workbook = await testApp.createWorkbook({ name: "Collecting", createdBy: userId });
    const [version] = await testApp.database
      .insert(workbookVersions)
      .values({
        workbookId: workbook.id,
        version: 1,
        cells: [],
        metadata: {},
        entitySnapshots: { protocols: {}, macros: {} },
        createdBy: userId,
      })
      .returning();

    const result = await repository.getWorkbookVersionMap([workbook.id]);

    assertSuccess(result);
    expect(result.value.get(version.id)).toBe(workbook.id);
  });

  it("names nothing for a resource the caller cannot read", async () => {
    const outsiderId = await testApp.createTestUser({});
    const hidden = await testApp.createProtocol({
      name: "Private protocol",
      createdBy: outsiderId,
      visibility: "private",
    });

    const result = await repository.getResourceName("protocol", hidden.id, userId);

    assertSuccess(result);
    expect(result.value).toBeNull();
  });

  it("maps no versions for an empty workbook list without querying", async () => {
    const result = await repository.getWorkbookVersionMap([]);

    assertSuccess(result);
    expect(result.value.size).toBe(0);
  });
  it("names a resource so the busiest one can be stated, and nothing for a stranger", async () => {
    const protocol = await testApp.createProtocol({
      name: "Leaf photosynthesis",
      createdBy: userId,
      visibility: "public",
    });

    const found = await repository.getResourceName("protocol", protocol.id, userId);
    const missing = await repository.getResourceName("macro", protocol.id, userId);

    assertSuccess(found);
    assertSuccess(missing);
    expect(found.value).toBe("Leaf photosynthesis");
    expect(missing.value).toBeNull();
  });
});
