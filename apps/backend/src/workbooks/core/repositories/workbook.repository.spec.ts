import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import { and, eq, experiments, resourceGrants } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { SuperTestResponse } from "../../../test/test-harness";
import { WorkbookRepository } from "./workbook.repository";

describe("WorkbookRepository", () => {
  const testApp = TestHarness.App;
  let repository: WorkbookRepository;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    repository = testApp.module.get(WorkbookRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const searchWorkbooks = async (query: string, asUser: string = testUserId) => {
    const result = await repository.findAll({ search: query, userId: asUser }, 20);
    assertSuccess(result);
    return result.value.map((workbook) => workbook.name);
  };

  describe("findAll search coverage", () => {
    it("matches the name", async () => {
      await testApp.createWorkbook({
        name: "Calibration helper workbook",
        createdBy: testUserId,
      });

      expect(await searchWorkbooks("calibration")).toContain("Calibration helper workbook");
    });

    it("matches the description", async () => {
      await testApp.createWorkbook({
        name: "Snarf notebook",
        description: "computes transpiration index",
        createdBy: testUserId,
      });

      expect(await searchWorkbooks("transpiration")).toContain("Snarf notebook");
    });

    it("matches the creator's name", async () => {
      const creator = await testApp.createTestUser({ name: "Ada Lovelace" });
      await testApp.createWorkbook({ name: "Blorp analysis", createdBy: creator });

      expect(await searchWorkbooks("lovelace")).toContain("Blorp analysis");
    });

    it("ranks a name match above a creator-only match", async () => {
      const creator = await testApp.createTestUser({ name: "Photosynthesis Researcher" });
      await testApp.createWorkbook({
        name: "Photosynthesis workbook",
        createdBy: testUserId,
      });
      await testApp.createWorkbook({ name: "Maize field notebook", createdBy: creator });

      const names = await searchWorkbooks("photosynthesis");

      expect(names).toContain("Photosynthesis workbook");
      expect(names).toContain("Maize field notebook");
      expect(names.indexOf("Photosynthesis workbook")).toBeLessThan(
        names.indexOf("Maize field notebook"),
      );
    });

    it("matches a linked experiment's name", async () => {
      const workbook = await testApp.createWorkbook({
        name: "Trellis notebook",
        createdBy: testUserId,
      });
      const { experiment } = await testApp.createExperiment({
        name: "Orbitron canopy trial",
        userId: testUserId,
      });
      await testApp.database
        .update(experiments)
        .set({ workbookId: workbook.id })
        .where(eq(experiments.id, experiment.id));

      expect(await searchWorkbooks("orbitron")).toContain("Trellis notebook");
    });

    it("matches a linked experiment's description", async () => {
      const workbook = await testApp.createWorkbook({
        name: "Brindle notebook",
        createdBy: testUserId,
      });
      const { experiment } = await testApp.createExperiment({
        name: "Fallow field trial",
        description: "quantifies evapotranspiration across plots",
        userId: testUserId,
      });
      await testApp.database
        .update(experiments)
        .set({ workbookId: workbook.id })
        .where(eq(experiments.id, experiment.id));

      expect(await searchWorkbooks("evapotranspiration")).toContain("Brindle notebook");
    });

    it("does not match a linked private experiment the requesting user cannot access", async () => {
      const otherUser = await testApp.createTestUser({});
      const workbook = await testApp.createWorkbook({
        name: "Sable notebook",
        createdBy: otherUser,
      });
      const { experiment } = await testApp.createExperiment({
        name: "Confidential xenobotany trial",
        userId: otherUser,
        visibility: "private",
      });
      await testApp.database
        .update(experiments)
        .set({ workbookId: workbook.id })
        .where(eq(experiments.id, experiment.id));

      expect(await searchWorkbooks("xenobotany")).not.toContain("Sable notebook");
    });

    it("matches a linked public experiment owned by another user", async () => {
      const otherUser = await testApp.createTestUser({});
      const workbook = await testApp.createWorkbook({
        name: "Topaz notebook",
        createdBy: otherUser,
      });
      const { experiment } = await testApp.createExperiment({
        name: "Open heliotropism trial",
        userId: otherUser,
        visibility: "public",
      });
      await testApp.database
        .update(experiments)
        .set({ workbookId: workbook.id })
        .where(eq(experiments.id, experiment.id));

      expect(await searchWorkbooks("heliotropism")).toContain("Topaz notebook");
    });

    it("does not match an archived linked experiment", async () => {
      const workbook = await testApp.createWorkbook({
        name: "Umber notebook",
        createdBy: testUserId,
      });
      const { experiment } = await testApp.createExperiment({
        name: "Obsolete gravitropism trial",
        userId: testUserId,
        status: "archived",
      });
      await testApp.database
        .update(experiments)
        .set({ workbookId: workbook.id })
        .where(eq(experiments.id, experiment.id));

      expect(await searchWorkbooks("gravitropism")).not.toContain("Umber notebook");
    });

    it("matches a linked protocol's name (via a cell reference, using the live name)", async () => {
      const protocol = await testApp.createProtocol({
        name: "Chlorophyll fluorometry",
        createdBy: testUserId,
      });
      // Cell references the protocol by id only (no payload.name) — the match must come from the
      // live protocol row, and the workbook name deliberately shares no term with it.
      await testApp.createWorkbook({
        name: "Zephyr notebook",
        createdBy: testUserId,
        cells: [
          { id: "cell-1", type: "protocol", payload: { protocolId: protocol.id, version: 1 } },
        ],
      });

      expect(await searchWorkbooks("chlorophyll")).toContain("Zephyr notebook");
    });

    it("matches a linked macro's name (via a cell reference, using the live name)", async () => {
      const macro = await testApp.createMacro({
        name: "Voronoi tessellation",
        createdBy: testUserId,
      });
      await testApp.createWorkbook({
        name: "Quill notebook",
        createdBy: testUserId,
        cells: [
          { id: "cell-1", type: "macro", payload: { macroId: macro.id, language: "python" } },
        ],
      });

      expect(await searchWorkbooks("voronoi")).toContain("Quill notebook");
    });

    it("matches a protocol referenced only inside a parallel lane", async () => {
      const protocol = await testApp.createProtocol({
        name: "Nested porometry",
        createdBy: testUserId,
      });
      await testApp.createWorkbook({
        name: "Lane protocol notebook",
        createdBy: testUserId,
        cells: [
          {
            id: "parallel-1",
            type: "parallel",
            name: "device_lanes",
            defaultLaneId: "lane-1",
            isCollapsed: false,
            lanes: [
              {
                id: "lane-1",
                label: "Lane 1",
                color: "#005E5E",
                conditions: [],
                body: [
                  {
                    id: "protocol-1",
                    type: "protocol",
                    isCollapsed: false,
                    payload: { protocolId: protocol.id, version: 1 },
                  },
                ],
              },
            ],
          },
        ],
      });

      expect(await searchWorkbooks("porometry")).toContain("Lane protocol notebook");
    });

    it("matches a macro referenced only inside a parallel lane", async () => {
      const macro = await testApp.createMacro({
        name: "Nested stomatal model",
        createdBy: testUserId,
      });
      await testApp.createWorkbook({
        name: "Lane macro notebook",
        createdBy: testUserId,
        cells: [
          {
            id: "parallel-1",
            type: "parallel",
            name: "device_lanes",
            defaultLaneId: "lane-1",
            isCollapsed: false,
            lanes: [
              {
                id: "lane-1",
                label: "Lane 1",
                color: "#005E5E",
                conditions: [],
                body: [
                  {
                    id: "macro-1",
                    type: "macro",
                    isCollapsed: false,
                    payload: { macroId: macro.id, language: "python" },
                  },
                ],
              },
            ],
          },
        ],
      });

      expect(await searchWorkbooks("stomatal")).toContain("Lane macro notebook");
    });

    it("does not match a stale/label payload.name that differs from the live entity name", async () => {
      const protocol = await testApp.createProtocol({
        name: "Actual protocol name",
        createdBy: testUserId,
      });
      // The cell carries a stale label; searching it must NOT surface the workbook (we match live).
      await testApp.createWorkbook({
        name: "Cobalt notebook",
        createdBy: testUserId,
        cells: [
          {
            id: "cell-1",
            type: "protocol",
            payload: { protocolId: protocol.id, version: 1, name: "Stalelabelxyz" },
          },
        ],
      });

      expect(await searchWorkbooks("stalelabelxyz")).not.toContain("Cobalt notebook");
      expect(await searchWorkbooks("actual protocol name")).toContain("Cobalt notebook");
    });

    it("does prefix matching", async () => {
      await testApp.createWorkbook({
        name: "Spectral analysis workbook",
        createdBy: testUserId,
      });

      expect(await searchWorkbooks("spectr")).toContain("Spectral analysis workbook");
    });

    it("matches names case-insensitively", async () => {
      await testApp.createWorkbook({
        name: "Casefold Canopy Workbook",
        createdBy: testUserId,
      });

      expect(await searchWorkbooks("CASEFOLD")).toContain("Casefold Canopy Workbook");
    });

    it("does stemming", async () => {
      await testApp.createWorkbook({
        name: "Running average workbook",
        createdBy: testUserId,
      });

      expect(await searchWorkbooks("run")).toContain("Running average workbook");
    });

    it("tolerates a typo via trigram matching", async () => {
      await testApp.createWorkbook({ name: "Bioluminescence", createdBy: testUserId });

      expect(await searchWorkbooks("bioluminecence")).toContain("Bioluminescence");
    });

    it("matches names containing punctuation", async () => {
      await testApp.createWorkbook({
        name: "Ridge-01 canopy workbook",
        createdBy: testUserId,
      });

      expect(await searchWorkbooks("ridge-01")).toContain("Ridge-01 canopy workbook");
    });

    it("excludes a deactivated creator from name matching", async () => {
      const ghost = await testApp.createTestUser({ name: "Calib Specter", activated: false });
      await testApp.createWorkbook({ name: "Hidden ledger", createdBy: ghost });

      expect(await searchWorkbooks("specter")).not.toContain("Hidden ledger");
    });

    it("excludes a soft-deleted creator from name matching", async () => {
      const deletedCreator = await testApp.createTestUser({
        name: "Removed Researcher",
        deletedAt: new Date(),
      });
      await testApp.createWorkbook({ name: "Ordinary notebook", createdBy: deletedCreator });

      expect(await searchWorkbooks("researcher")).not.toContain("Ordinary notebook");
    });

    it("respects the requested search result limit", async () => {
      for (const suffix of ["Alpha", "Bravo", "Charlie"]) {
        await testApp.createWorkbook({
          name: `Limitprobe ${suffix}`,
          createdBy: testUserId,
        });
      }

      const result = await repository.findAll({ search: "limitprobe", userId: testUserId }, 2);

      assertSuccess(result);
      expect(result.value).toHaveLength(2);
    });
  });

  describe("grant teardown on delete", () => {
    let owner: string;
    let grantee: string;

    beforeEach(async () => {
      owner = await testApp.createTestUser({ name: "Teardown Owner" });
      grantee = await testApp.createTestUser({ name: "Teardown Grantee" });
    });

    /** The grants on one resource — no FK cascade cleans `resource_grants` up. */
    const grantsFor = (resourceId: string) =>
      testApp.database
        .select()
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "workbook"),
            eq(resourceGrants.resourceId, resourceId),
          ),
        );

    async function sharedWorkbook() {
      const resource = await testApp.createWorkbook({ name: "W", createdBy: owner });
      await testApp.addResourceGrant({
        resourceType: "workbook",
        resourceId: resource.id,
        granteeType: "user",
        granteeId: grantee,
        role: "viewer",
      });
      // Only the share above: a creator holds no grant on what they create.
      expect(await grantsFor(resource.id)).toHaveLength(1);
      return resource;
    }

    it("deletes the workbook's grants along with it", async () => {
      const resource = await sharedWorkbook();

      assertSuccess(await repository.delete(resource.id));

      expect(await grantsFor(resource.id)).toHaveLength(0);
    });
  });
});

/**
 * Access scoping for workbook listing: a private workbook is only visible to
 * owning-org members and grantees; public workbooks are visible to everyone. Mirrors the experiment `findAll` scoping.
 */
describe("WorkbookRepository — list access scoping", () => {
  const testApp = TestHarness.App;
  let repository: WorkbookRepository;
  let owner: string;
  let orgId: string;
  let privateId: string;
  let publicId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(WorkbookRepository);

    owner = await testApp.createTestUser({ name: "Workbook Owner" });
    orgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(orgId, owner, "owner");

    const priv = await testApp.createWorkbook({
      name: "Private workbook",
      createdBy: owner,
      visibility: "private",
      organizationId: orgId,
    });
    privateId = priv.id;

    const pub = await testApp.createWorkbook({
      name: "Public workbook",
      createdBy: owner,
      visibility: "public",
      organizationId: orgId,
    });
    publicId = pub.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const listIdsFor = async (userId: string | undefined) => {
    const result = await repository.findAll({ userId });
    assertSuccess(result);
    return result.value.map((w) => w.id);
  };

  it("hides a private workbook from a stranger but shows the public one", async () => {
    const stranger = await testApp.createTestUser({ name: "Stranger" });

    const ids = await listIdsFor(stranger);

    expect(ids).toContain(publicId);
    expect(ids).not.toContain(privateId);
  });

  it("shows a private workbook to a member of the owning organization", async () => {
    const orgMember = await testApp.createTestUser({ name: "Org Member" });
    await testApp.addOrganizationMember(orgId, orgMember, "member");

    const ids = await listIdsFor(orgMember);

    expect(ids).toContain(privateId);
    expect(ids).toContain(publicId);
  });

  it("shows a private workbook to a direct user grantee", async () => {
    const grantee = await testApp.createTestUser({ name: "User Grantee" });
    await testApp.addResourceGrant({
      resourceType: "workbook",
      resourceId: privateId,
      granteeType: "user",
      granteeId: grantee,
      role: "viewer",
    });

    const ids = await listIdsFor(grantee);

    expect(ids).toContain(privateId);
  });

  it("shows a private workbook to a member of a grantee organization", async () => {
    const orgGrantee = await testApp.createTestUser({ name: "Org Grantee" });
    const granteeOrgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(granteeOrgId, orgGrantee, "member");
    await testApp.addResourceGrant({
      resourceType: "workbook",
      resourceId: privateId,
      granteeType: "organization",
      granteeId: granteeOrgId,
      role: "viewer",
    });

    const ids = await listIdsFor(orgGrantee);

    expect(ids).toContain(privateId);
  });

  it("shows the owner both workbooks", async () => {
    const ids = await listIdsFor(owner);

    expect(ids).toContain(privateId);
    expect(ids).toContain(publicId);
  });

  it("shows only public workbooks when there is no caller", async () => {
    const ids = await listIdsFor(undefined);

    expect(ids).toContain(publicId);
    expect(ids).not.toContain(privateId);
  });

  it('keeps the "my" filter as an ownership view, unaffected by visibility', async () => {
    const other = await testApp.createTestUser({ name: "Other Author" });
    const othersWorkbook = await testApp.createWorkbook({
      name: "Someone else's workbook",
      createdBy: other,
      visibility: "public",
    });

    const result = await repository.findAll({ filter: "my", userId: owner });
    assertSuccess(result);
    const ids = result.value.map((w) => w.id);

    expect(ids).toEqual(expect.arrayContaining([privateId, publicId]));
    expect(ids).not.toContain(othersWorkbook.id);
  });

  it("does not surface a public workbook via a private linked protocol's name to a stranger", async () => {
    // A public workbook references a private protocol. Probing the private
    // protocol's name must not reveal the association to a caller who cannot
    // read that protocol, yet the linked-name search
    // still works for someone who can (the owning-org member).
    const linkedProtocol = await testApp.createProtocol({
      name: "Xylophonium reagent",
      createdBy: owner,
      visibility: "private",
      organizationId: orgId,
    });
    const holderWorkbook = await testApp.createWorkbook({
      name: "Plain holder workbook",
      createdBy: owner,
      visibility: "public",
      organizationId: orgId,
      cells: [
        {
          id: "p1",
          type: "protocol",
          isCollapsed: false,
          payload: { protocolId: linkedProtocol.id, version: 1 },
        },
      ],
    });

    const stranger = await testApp.createTestUser({ name: "Prober" });
    const strangerHits = await repository.findAll({ search: "Xylophonium", userId: stranger });
    assertSuccess(strangerHits);
    expect(strangerHits.value.map((w) => w.id)).not.toContain(holderWorkbook.id);

    const ownerHits = await repository.findAll({ search: "Xylophonium", userId: owner });
    assertSuccess(ownerHits);
    expect(ownerHits.value.map((w) => w.id)).toContain(holderWorkbook.id);
  });
});

/**
 * Private-at-create round-trip: the create route accepts an optional visibility
 * (default public) and persists it; the update body never carries visibility.
 */
describe("WorkbookController — create with visibility", () => {
  const testApp = TestHarness.App;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({ name: "Creator" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const createPath = () => testApp.resolveOrpcPath(contract.workbooks.createWorkbook);

  it("persists visibility=private when requested", async () => {
    const response: SuperTestResponse<{ id: string; visibility: string }> = await testApp
      .post(createPath())
      .withAuth(testUserId)
      .send({ name: "Private at create", visibility: "private" })
      .expect(StatusCodes.CREATED);

    expect(response.body.visibility).toBe("private");
  });

  it("defaults to public when visibility is omitted", async () => {
    const response: SuperTestResponse<{ id: string; visibility: string }> = await testApp
      .post(createPath())
      .withAuth(testUserId)
      .send({ name: "Default visibility" })
      .expect(StatusCodes.CREATED);

    expect(response.body.visibility).toBe("public");
  });
});
