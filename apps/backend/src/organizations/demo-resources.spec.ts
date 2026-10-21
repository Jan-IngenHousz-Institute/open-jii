import { z } from "zod";

import { eq, sql, workbooks } from "@repo/database";

import { TestHarness } from "../test/test-harness";

describe("Demo resource and directory HTTP behavior", () => {
  const app = TestHarness.App;
  beforeAll(() => app.setup());
  beforeEach(() => app.beforeEach());
  afterEach(() => app.afterEach());
  afterAll(() => app.teardown());

  async function fixture() {
    const owner = await app.createTestUser();
    const outsider = await app.createTestUser();
    const organizationId = await app.createOrganization("Demo research", {
      type: "demo",
      visibility: "public",
    });
    await app.addOrganizationMember(organizationId, owner, "owner");
    return { owner, outsider, organizationId };
  }

  it.each([
    ["workbooks", { name: "Public workbook" }],
    ["protocols", { name: "Public protocol", code: [{ steps: [] }], family: "multispeq" }],
    ["macros", { name: "Public macro", language: "python", code: "cmV0dXJuIHt9" }],
    ["experiments", { name: "Public experiment" }],
  ])(
    "refuses explicit private creation of %s before any resource write",
    async (resource, body) => {
      const { owner, organizationId } = await fixture();
      await app
        .post(`/api/v1/${resource}`)
        .withAuth(owner)
        .send({ ...body, organizationId, visibility: "private" })
        .expect(403);
      const rows = await app.database.execute(
        sql.raw(`select id from ${resource} where organization_id = '${organizationId}'`),
      );
      expect(rows).toHaveLength(0);
    },
  );

  it("lists Demo and derives read-only organizationType on experiment get and every list form", async () => {
    const { owner, outsider, organizationId } = await fixture();
    const { experiment } = await app.createExperiment({
      name: "Demo experiment",
      userId: owner,
      organizationId,
      visibility: "public",
    });
    const directory = await app
      .get("/api/v1/organizations?search=Demo")
      .withAuth(outsider)
      .expect(200);
    expect(
      z
        .object({
          organizations: z.array(z.object({ id: z.string(), type: z.string().nullable() })),
        })
        .parse(directory.body).organizations,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: organizationId, type: "demo" })]),
    );
    const detail = await app
      .get(`/api/v1/experiments/${experiment.id}`)
      .withAuth(outsider)
      .expect(200);
    expect(
      z.object({ organizationType: z.string().nullable() }).parse(detail.body).organizationType,
    ).toBe("demo");
    const list = await app.get("/api/v1/experiments?scope=all").withAuth(outsider).expect(200);
    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: experiment.id, organizationType: "demo" }),
      ]),
    );
    const page = await app
      .get("/api/v1/experiments?scope=all&page=1&pageSize=20")
      .withAuth(outsider)
      .expect(200);
    expect(
      z
        .object({
          items: z.array(z.object({ id: z.string(), organizationType: z.string().nullable() })),
        })
        .parse(page.body).items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: experiment.id, organizationType: "demo" }),
      ]),
    );
    await app
      .patch(`/api/v1/experiments/${experiment.id}`)
      .withAuth(outsider)
      .send({ name: "Forged" })
      .expect(403);
    await app
      .post(`/api/v1/organizations/${organizationId}/join-requests`)
      .withAuth(outsider)
      .send({})
      .expect(403);
  });

  it.each(["experiment", "macro", "protocol", "workbook"] as const)(
    "refuses a private %s HTTP transfer with a safe 4xx and leaves ownership unchanged",
    async (resourceType) => {
      const { owner, organizationId } = await fixture();
      const ordinary = await app.createOrganization();
      await app.addOrganizationMember(ordinary, owner, "owner");
      const data = {
        name: `Private ${resourceType}`,
        createdBy: owner,
        organizationId: ordinary,
        visibility: "private" as const,
      };
      const resource =
        resourceType === "experiment"
          ? (await app.createExperiment({ ...data, userId: owner })).experiment
          : resourceType === "macro"
            ? await app.createMacro(data)
            : resourceType === "protocol"
              ? await app.createProtocol(data)
              : await app.createWorkbook(data);
      const response = await app
        .post(`/api/v1/${resourceType}/${resource.id}/transfer`)
        .withAuth(owner)
        .send({ targetOrganizationId: organizationId })
        .expect(400);
      expect(response.body).toMatchObject({
        message: "Demo organizations can only own public resources",
      });
      expect(JSON.stringify(response.body)).not.toMatch(/UPDATE|params:|Failed query/i);
      const table = `${resourceType}s`;
      const rows = await app.database.execute(
        sql.raw(`select organization_id from ${table} where id = '${resource.id}'`),
      );
      expect(rows).toEqual([expect.objectContaining({ organization_id: ordinary })]);
    },
  );

  it("refuses private transfer writes and never leaves demo/private organization rows", async () => {
    const { owner, organizationId } = await fixture();
    const ordinary = await app.createOrganization();
    const privateWorkbook = await app.createWorkbook({
      name: "Private workbook",
      createdBy: owner,
      organizationId: ordinary,
      visibility: "private",
    });
    await expect(
      app.database
        .update(workbooks)
        .set({ organizationId })
        .where(eq(workbooks.id, privateWorkbook.id)),
    ).rejects.toThrow();
    expect(
      (await app.database.select().from(workbooks).where(eq(workbooks.id, privateWorkbook.id)))[0]
        .organizationId,
    ).toBe(ordinary);
    expect(
      await app.database.execute(
        sql`select id from organizations where type::text = 'demo' and visibility::text <> 'public'`,
      ),
    ).toHaveLength(0);
  });
});
