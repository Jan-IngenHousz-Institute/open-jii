import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { ModulesContainer, Reflector } from "@nestjs/core";
import { z } from "zod";

import { contract } from "@repo/api/contract";
import {
  db,
  eq,
  experiments,
  guestOrganizationUsage,
  guestUsage,
  notifications,
  organizationMembers,
  resourceGrants,
  sessions,
  users,
} from "@repo/database";

import { AwsAdapter } from "../common/modules/aws/aws.adapter";
import { success, failure, AppError, assertSuccess } from "../common/utils/fp-utils";
import { AddAnnotationsUseCase } from "../experiments/application/use-cases/experiment-data-annotations/add-annotations/add-annotations";
import { DeleteAnnotationsUseCase } from "../experiments/application/use-cases/experiment-data-annotations/delete-annotations/delete-annotations";
import { UpdateAnnotationUseCase } from "../experiments/application/use-cases/experiment-data-annotations/update-annotation/update-annotation";
import { ListExportsUseCase } from "../experiments/application/use-cases/experiment-data-exports/list-exports";
import { ListUploadsUseCase } from "../experiments/application/use-cases/experiment-data-uploads/list-uploads";
import { UploadDataUseCase } from "../experiments/application/use-cases/experiment-data-uploads/upload-data";
import { LAMBDA_PORT } from "../macros/core/ports/lambda.port";
import type { LambdaPort } from "../macros/core/ports/lambda.port";
import { TestHarness } from "../test/test-harness";
import { WorkbookVersionRepository } from "../workbooks/core/repositories/workbook-version.repository";
import { AuthorizationService } from "./authorization.service";
import { CAN_ACCESS_KEY } from "./can-access.guard";
import type { CanAccessMetadata } from "./can-access.guard";
import { DEMO_MODE_PORT } from "./core/ports/demo-mode.port";
import type { DemoModePort } from "./core/ports/demo-mode.port";
import { guestRouteInventory, guestNativeRouteInventory } from "./guest-routes";

describe("guest authorization HTTP boundary", () => {
  const app = TestHarness.App;
  let visitor: string;
  let researcher: string;
  let ordinary: string;
  let demo: string;
  let publicExperiment: string;
  let privateExperiment: string;
  beforeAll(() => app.setup());
  beforeEach(async () => {
    await app.beforeEach();
    researcher = await app.createTestUser();
    demo = await app.createOrganization(undefined, { type: "demo", visibility: "public" });
    ordinary = await app.createOrganization(undefined, {
      type: "university",
      visibility: "public",
    });
    const [guest] = await db
      .insert(users)
      .values({
        name: "Synthetic visitor",
        email: `${crypto.randomUUID()}@guest.openjii.invalid`,
        isAnonymous: true,
      })
      .returning();
    visitor = guest.id;
    await db.insert(sessions).values({
      userId: visitor,
      token: `test-token-${visitor}`,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    const inserted = await db
      .insert(experiments)
      .values([
        {
          name: "Public ordinary example",
          createdBy: researcher,
          organizationId: ordinary,
          visibility: "public",
        },
        {
          name: "Private ordinary example",
          createdBy: researcher,
          organizationId: ordinary,
          visibility: "private",
        },
      ])
      .returning();
    publicExperiment = inserted[0].id;
    privateExperiment = inserted[1].id;
    await db.insert(resourceGrants).values({
      resourceType: "experiment",
      resourceId: privateExperiment,
      granteeType: "user",
      granteeId: visitor,
      role: "admin",
      createdBy: researcher,
    });
  });
  afterEach(() => app.afterEach());
  afterAll(() => app.teardown());

  it("exposes only demo availability to anonymous, guest and researcher callers", async () => {
    const path = "/api/v1/users/demo-availability";
    const anonymous = await app.get(path).expect(200);
    expect(z.object({ enabled: z.boolean() }).strict().safeParse(anonymous.body).success).toBe(
      true,
    );
    for (const id of [visitor, researcher]) {
      const response = await app.get(path).withAuth(id).expect(200);
      expect(response.body).toEqual(anonymous.body);
    }
  });

  function registeredRoutes() {
    const nativeRoutes: {
      procedure: string;
      method: string;
      path: string;
      access?: CanAccessMetadata;
    }[] = [];
    for (const module of app.module.get(ModulesContainer).values()) {
      for (const wrapper of module.controllers.values()) {
        const controller = wrapper.metatype;
        if (!controller) continue;
        const controllerPath = z.string().parse(Reflect.getMetadata(PATH_METADATA, controller));
        const prototype: unknown = controller.prototype;
        if (typeof prototype !== "object" || prototype === null) continue;
        for (const name of Object.getOwnPropertyNames(prototype)) {
          const handler: unknown = Reflect.get(prototype, name);
          if (typeof handler !== "function") continue;
          const rawMethod: unknown = Reflect.getMetadata(METHOD_METADATA, handler);
          if (rawMethod === undefined) continue;
          const method = RequestMethod[z.number().int().parse(rawMethod)];
          const handlerPath = z.string().parse(Reflect.getMetadata(PATH_METADATA, handler));
          const path = `/${controllerPath}/${handlerPath}`
            .replace(/\/+/g, "/")
            .replace(/\/$/, "")
            .replace(/:([A-Za-z][A-Za-z0-9_]*)/g, "{$1}");
          nativeRoutes.push({
            procedure: `${controller.name}.${name}`,
            method,
            path,
            access: app.module
              .get(Reflector)
              .get<CanAccessMetadata | undefined>(CAN_ACCESS_KEY, handler),
          });
        }
      }
    }
    return nativeRoutes;
  }

  it("classifies every undecorated route and keeps decorated routes out of the inventory", () => {
    const inventories = [...guestRouteInventory, ...guestNativeRouteInventory];
    const registered = registeredRoutes();
    const key = (route: { method: string; path: string }) => route.method + " " + route.path;
    expect(
      registered
        .filter(({ access }) => !access)
        .map(key)
        .sort(),
    ).toEqual(inventories.map(key).sort());
    const routes = z
      .record(
        z.string(),
        z.record(
          z.string(),
          z.object({
            "~orpc": z.object({ route: z.object({ method: z.string(), path: z.string() }) }),
          }),
        ),
      )
      .parse(contract);
    const contracted = Object.values(routes).flatMap((domain) =>
      Object.values(domain).map((procedure) => key(procedure["~orpc"].route)),
    );
    const classified = new Set(registered.map(key));
    expect(contracted.every((route) => classified.has(route))).toBe(true);
    expect(new Set(inventories.map(key)).size).toBe(inventories.length);
  });

  it("pins every decorated guest opt-in; new opt-ins require a boundary review", () => {
    expect(
      registeredRoutes()
        .filter(({ access }) => access?.guest === true)
        .map(({ method, path }) => method + " " + path)
        .sort(),
    ).toEqual([
      "GET /api/v1/experiments/{id}",
      "GET /api/v1/experiments/{id}/access",
      "GET /api/v1/experiments/{id}/contributors",
      "GET /api/v1/experiments/{id}/dashboards",
      "GET /api/v1/experiments/{id}/dashboards/{dashboardId}",
      "GET /api/v1/experiments/{id}/data",
      "GET /api/v1/experiments/{id}/data/columns",
      "GET /api/v1/experiments/{id}/data/distinct",
      "GET /api/v1/experiments/{id}/flow",
      "GET /api/v1/experiments/{id}/locations",
      "GET /api/v1/experiments/{id}/metadata",
      "GET /api/v1/experiments/{id}/tables",
      "GET /api/v1/experiments/{id}/visualizations",
      "GET /api/v1/experiments/{id}/visualizations/{visualizationId}",
      "GET /api/v1/macros/{id}",
      "GET /api/v1/macros/{id}/protocols",
      "GET /api/v1/protocols/{id}",
      "GET /api/v1/protocols/{id}/macros",
      "GET /api/v1/workbooks/{id}",
      "GET /api/v1/workbooks/{id}/versions",
      "GET /api/v1/workbooks/{id}/versions/{versionId}",
      "POST /api/v1/iot/upload-url",
      "POST /api/v1/macros/{id}/execute",
    ]);
  });

  it("refuses every deny-classified contract mutation before handler effects", async () => {
    const before = {
      users: await db.select().from(users),
      experiments: await db.select().from(experiments),
      grants: await db.select().from(resourceGrants),
      members: await db.select().from(organizationMembers),
      notifications: await db.select().from(notifications),
    };
    for (const route of [...guestRouteInventory, ...guestNativeRouteInventory].filter(
      ({ method, classification }) => method !== "GET" && classification === "deny",
    )) {
      const path = route.path.replace(/\{[^}]+\}/g, publicExperiment);
      const body = {
        name: "Must not persist",
        organizationId: ordinary,
        experimentId: publicExperiment,
        role: "admin",
        decision: "approve",
        data: {},
      };
      const response = await app[
        route.method.toLowerCase() === "delete"
          ? "delete"
          : route.method === "PUT"
            ? "put"
            : route.method === "PATCH"
              ? "patch"
              : "post"
      ](path)
        .withAuth(visitor, true)
        .send(body);
      expect(response.status, `${route.method} ${path}: ${JSON.stringify(response.body)}`).toBe(
        403,
      );
      expect(response.body).toMatchObject({ code: "GUEST_ACTION_FORBIDDEN" });
    }
    expect(await db.select().from(users)).toEqual(before.users);
    expect(await db.select().from(experiments)).toEqual(before.experiments);
    expect(await db.select().from(resourceGrants)).toEqual(before.grants);
    expect(await db.select().from(organizationMembers)).toEqual(before.members);
    expect(await db.select().from(notifications)).toEqual(before.notifications);
  }, 30_000);

  it("reads ordinary public experiments, but a private grant cannot expose details or list rows", async () => {
    expect(
      (await app.get(`/api/v1/experiments/${publicExperiment}`).withAuth(visitor, true)).status,
    ).toBe(200);
    expect(
      (await app.get(`/api/v1/experiments/${privateExperiment}`).withAuth(visitor, true)).status,
    ).toBe(403);
    const response = await app.get(`/api/v1/experiments?scope=all`).withAuth(visitor, true);
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).toContain(publicExperiment);
    expect(JSON.stringify(response.body)).not.toContain(privateExperiment);
    const access = app.module.get(AuthorizationService);
    for (const action of ["update", "manage", "share", "contribute"] as const) {
      expect(
        await access.can(visitor, {
          resourceType: "experiment",
          resourceId: privateExperiment,
          action,
        }),
      ).toMatchObject({ allow: false });
    }
  });

  it("never exposes credentials or private service feeds, even through GET routes", async () => {
    for (const route of [...guestRouteInventory, ...guestNativeRouteInventory].filter(
      ({ method, classification }) => method === "GET" && classification === "deny",
    )) {
      const path = route.path.replace(/\{[^}]+\}/g, publicExperiment);
      const response = await app.get(path).withAuth(visitor, true);
      expect(response.status, path).toBe(403);
      expect(response.body).toMatchObject({ code: "GUEST_ACTION_FORBIDDEN" });
    }
  });

  it("issues only Demo guest uploads, enforces size, and caps the 61st before AWS", async () => {
    const flag = vi
      .spyOn(app.module.get<DemoModePort>(DEMO_MODE_PORT), "isEnabled")
      .mockResolvedValue(true);
    const signer = vi.spyOn(app.module.get(AwsAdapter), "getIotUploadUrl").mockResolvedValue(
      success({
        uploadUrl: "https://example.test/signed",
        key: "large-iot/demo/guest/uploader-id/synthetic.json",
        expiresAt: new Date(),
      }),
    );
    const { experiment } = await app.createExperiment({
      name: "Synthetic demo",
      userId: researcher,
      organizationId: demo,
      visibility: "public",
    });
    const post = (experimentId: string, contentLength?: number) =>
      app
        .post("/api/v1/iot/upload-url")
        .withAuth(visitor, true)
        .send({ experimentId, ...(contentLength !== undefined ? { contentLength } : {}) });
    expect((await post(publicExperiment, 20)).status).toBe(403);
    for (const size of [undefined, 0, -1, 1.5, 1_048_577])
      expect((await post(experiment.id, size)).status).toBe(400);
    expect(signer).not.toHaveBeenCalled();
    flag.mockClear();
    for (let i = 0; i < 60; i++) expect((await post(experiment.id, 20)).status).toBe(200);
    expect(flag).toHaveBeenCalledTimes(60);
    expect(signer).toHaveBeenLastCalledWith(experiment.id, visitor, { guestContentLength: 20 });
    const limited = await post(experiment.id, 20);
    expect(limited.status).toBe(429);
    expect(z.object({ message: z.string() }).parse(limited.body).message).toMatch(
      /Try again in \d+ seconds/,
    );
    expect(
      z
        .object({ data: z.object({ retryAfterSeconds: z.number().int().positive().max(3600) }) })
        .parse(limited.body).data.retryAfterSeconds,
    ).toBeGreaterThan(0);
    expect(signer).toHaveBeenCalledTimes(60);
  }, 30_000);

  it("executes only Demo macros while enabled, with an independent persisted cap", async () => {
    const flag = vi
      .spyOn(app.module.get<DemoModePort>(DEMO_MODE_PORT), "isEnabled")
      .mockResolvedValue(true);
    const lambda = app.module.get<LambdaPort>(LAMBDA_PORT);
    const invoke = vi.spyOn(lambda, "invokeLambda").mockResolvedValue(
      success({
        statusCode: 200,
        payload: {
          status: "success",
          results: [{ id: "single", success: true, output: { value: 1 } }],
        },
      }),
    );
    vi.spyOn(lambda, "getFunctionNameForLanguage").mockReturnValue("synthetic-macro");
    const macro = await app.createMacro({
      name: "Synthetic demo",
      createdBy: researcher,
      organizationId: demo,
      visibility: "public",
    });
    const normal = await app.createMacro({
      name: "Synthetic ordinary",
      createdBy: researcher,
      organizationId: ordinary,
      visibility: "public",
    });
    const run = (id: string) =>
      app
        .post(`/api/v1/macros/${id}/execute`)
        .withAuth(visitor, true)
        .send({ data: { value: 1 } });
    expect((await run(normal.id)).status).toBe(403);
    flag.mockResolvedValue(false);
    expect((await run(macro.id)).status).toBe(403);
    expect(invoke).not.toHaveBeenCalled();
    flag.mockResolvedValue(true);
    expect(
      (
        await app
          .post(`/api/v1/macros/${macro.id}/execute`)
          .withAuth(visitor, true)
          .send({ data: { value: 1 }, timeout: -1 })
      ).status,
    ).toBe(400);
    flag.mockClear();
    for (let i = 0; i < 60; i++) expect((await run(macro.id)).status).toBe(200);
    expect(flag).toHaveBeenCalledTimes(60);
    const limited = await run(macro.id);
    expect(limited.status).toBe(429);
    expect(
      z
        .object({ data: z.object({ retryAfterSeconds: z.number().int().positive().max(3600) }) })
        .parse(limited.body).data.retryAfterSeconds,
    ).toBeGreaterThan(0);
    expect(invoke).toHaveBeenCalledTimes(60);
  }, 30_000);

  it("runs a guest's pinned snapshot within both Demo macro budgets", async () => {
    const flag = vi
      .spyOn(app.module.get<DemoModePort>(DEMO_MODE_PORT), "isEnabled")
      .mockResolvedValue(true);
    const lambda = app.module.get<LambdaPort>(LAMBDA_PORT);
    vi.spyOn(lambda, "getFunctionNameForLanguage").mockReturnValue("synthetic-macro");
    const invoke = vi.spyOn(lambda, "invokeLambda").mockResolvedValue(
      success({
        statusCode: 200,
        payload: { status: "success", results: [{ id: "single", success: true, output: {} }] },
      }),
    );
    const macro = await app.createMacro({
      name: "Pinned Demo macro",
      createdBy: researcher,
      organizationId: demo,
      visibility: "public",
      code: "bGl2ZQ==",
    });
    const workbook = await app.createWorkbook({
      name: "Pinned Demo workbook",
      createdBy: researcher,
      organizationId: demo,
      visibility: "public",
    });
    const version = await app.module.get(WorkbookVersionRepository).create({
      workbookId: workbook.id,
      version: 1,
      cells: [
        {
          id: "macro-cell",
          type: "macro",
          isCollapsed: false,
          payload: { macroId: macro.id, language: "python" },
        },
      ],
      metadata: {},
      entitySnapshots: {
        protocols: {},
        macros: { [macro.id]: { code: "cGlubmVk", language: "python" } },
      },
      createdBy: researcher,
    });
    assertSuccess(version);
    const run = () =>
      app
        .post(`/api/v1/macros/${macro.id}/execute`)
        .withAuth(visitor, true)
        .send({ data: { value: 1 }, workbookVersionId: version.value.id });

    expect((await run()).status).toBe(200);
    expect(invoke).toHaveBeenCalledWith(
      "synthetic-macro",
      expect.objectContaining({ script: "cGlubmVk" }),
    );
    expect(flag).toHaveBeenCalledTimes(1);
    expect(
      await db
        .select({ kind: guestUsage.kind, count: guestUsage.count })
        .from(guestUsage)
        .where(eq(guestUsage.userId, visitor)),
    ).toEqual([{ kind: "macro", count: 1 }]);
    expect(
      await db
        .select({ kind: guestOrganizationUsage.kind, count: guestOrganizationUsage.count })
        .from(guestOrganizationUsage)
        .where(eq(guestOrganizationUsage.organizationId, demo)),
    ).toEqual([{ kind: "macro", count: 1 }]);

    await db
      .update(guestOrganizationUsage)
      .set({ count: 1200 })
      .where(eq(guestOrganizationUsage.organizationId, demo));
    expect((await run()).status).toBe(429);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(
      await db
        .select({ count: guestUsage.count })
        .from(guestUsage)
        .where(eq(guestUsage.userId, visitor)),
    ).toEqual([{ count: 1 }]);
  });

  it.each(["upload", "macro"] as const)(
    "returns the same 429 for the shared %s budget before external work",
    async (kind) => {
      vi.spyOn(app.module.get<DemoModePort>(DEMO_MODE_PORT), "isEnabled").mockResolvedValue(true);
      const signer = vi.spyOn(app.module.get(AwsAdapter), "getIotUploadUrl");
      const invoke = vi.spyOn(app.module.get<LambdaPort>(LAMBDA_PORT), "invokeLambda");
      const { experiment } = await app.createExperiment({
        name: "Demo budget",
        userId: researcher,
        organizationId: demo,
        visibility: "public",
      });
      const macro = await app.createMacro({
        name: "Demo budget",
        createdBy: researcher,
        organizationId: demo,
        visibility: "public",
      });
      const windowStart = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
      await db
        .insert(guestOrganizationUsage)
        .values({ organizationId: demo, kind, windowStart, count: 1200 });
      const response = await app
        .post(
          kind === "upload" ? "/api/v1/iot/upload-url" : "/api/v1/macros/" + macro.id + "/execute",
        )
        .withAuth(visitor, true)
        .send(
          kind === "upload"
            ? { experimentId: experiment.id, contentLength: 20 }
            : { data: { value: 1 } },
        );
      expect(response.status).toBe(429);
      expect(
        z
          .object({
            code: z.literal("TOO_MANY_REQUESTS"),
            data: z.object({
              code: z.literal("GUEST_RATE_LIMITED"),
              retryAfterSeconds: z.number().int().positive().max(3600),
            }),
          })
          .safeParse(response.body).success,
      ).toBe(true);
      expect(signer).not.toHaveBeenCalled();
      expect(invoke).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["post", "/data/uploads", { sourceKind: "csv" }, "upload"],
    ["post", "/data/uploads", { sourceKind: "parquet" }, "upload"],
    [
      "post",
      "/data/annotations",
      {
        tableName: "raw_data",
        rowId: "row",
        annotation: { type: "comment", content: { type: "comment", text: "Example" } },
      },
      "add",
    ],
    [
      "patch",
      "/data/annotations/00000000-0000-4000-8000-000000000001",
      { content: { type: "comment", text: "Edit" } },
      "update",
    ],
    ["delete", "/data/annotations/00000000-0000-4000-8000-000000000001", {}, "delete"],
    ["get", "/data/uploads", {}, "uploads"],
    ["get", "/data/exports?tableName=raw_data", {}, "exports"],
  ] as const)(
    "preserves the anonymous, guest and researcher boundary for %s %s",
    async (method, suffix, body, handler) => {
      const denied = failure(AppError.badRequest("Researcher handler reached"));
      const handlers = {
        upload: vi.spyOn(app.module.get(UploadDataUseCase), "execute").mockResolvedValue(denied),
        add: vi.spyOn(app.module.get(AddAnnotationsUseCase), "execute").mockResolvedValue(denied),
        update: vi
          .spyOn(app.module.get(UpdateAnnotationUseCase), "execute")
          .mockResolvedValue(denied),
        delete: vi
          .spyOn(app.module.get(DeleteAnnotationsUseCase), "execute")
          .mockResolvedValue(denied),
        uploads: vi.spyOn(app.module.get(ListUploadsUseCase), "execute").mockResolvedValue(denied),
        exports: vi.spyOn(app.module.get(ListExportsUseCase), "execute").mockResolvedValue(denied),
      };
      const { experiment } = await app.createExperiment({
        name: "Boundary fixture",
        userId: researcher,
        organizationId: demo,
        visibility: "public",
      });
      await db
        .insert(organizationMembers)
        .values({ userId: researcher, organizationId: demo, role: "owner" })
        .onConflictDoNothing();
      const path = "/api/v1/experiments/" + experiment.id + suffix;
      expect((await app[method](path).withoutAuth().send(body)).status).toBe(401);
      expect((await app[method](path).withAuth(visitor, true).send(body)).status).toBe(403);
      expect(handlers[handler]).not.toHaveBeenCalled();
      const response = await app[method](path).withAuth(researcher).send(body);
      expect(response.status, JSON.stringify(response.body)).toBe(400);
      expect(handlers[handler]).toHaveBeenCalledOnce();
    },
  );

  it("a deleted guest cannot use the stale session after purge", async () => {
    await db.delete(resourceGrants).where(eq(resourceGrants.granteeId, visitor));
    await db.delete(users).where(eq(users.id, visitor));
    expect(
      (await app.get(`/api/v1/experiments/${publicExperiment}`).withAuth(visitor, true)).status,
    ).toBe(401);
  });
});
