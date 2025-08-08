import { faker } from "@faker-js/faker";
import type { INestApplication } from "@nestjs/common";
import type { ModuleMetadata } from "@nestjs/common/interfaces";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { config } from "dotenv";
import nock from "nock";
import { resolve } from "path";
import request from "supertest";
import type { Response } from "supertest";
import type { App } from "supertest/types";

import * as authExpress from "@repo/auth/express";
import type { DatabaseInstance } from "@repo/database";
import {
  experimentMembers,
  experiments,
  users,
  auditLogs,
  profiles,
  protocols,
  experimentProtocols,
  organizations,
  flows,
} from "@repo/database";

import { AppModule } from "../app.module";

// Ensure test environment is loaded
config({ path: resolve(__dirname, "../../.env.test") });

export type SuperTestResponse<T> = Omit<Response, "body"> & { body: T };

export class TestHarness {
  private app: INestApplication<App> | null = null;
  private static _appInstance: TestHarness | null = null;
  private readonly _imports: ModuleMetadata["imports"];
  private _module: TestingModule | null = null;
  private _request: ReturnType<typeof request> | null = null;

  private constructor(imports: ModuleMetadata["imports"]) {
    this._imports = imports;
  }

  public static get App() {
    return this._appInstance ?? (this._appInstance = new this([AppModule]));
  }

  /**
   * Set up the application for testing
   */
  public async setup() {
    if (!this.app) {
      // Configure nock to prevent any real HTTP requests during tests
      nock.disableNetConnect();
      // But allow localhost connections for the test server
      nock.enableNetConnect("127.0.0.1");

      this._module = await Test.createTestingModule({
        imports: this._imports,
      }).compile();

      this.app = this._module.createNestApplication<INestApplication<App>>();
      await this.app.init();
      this._request = request(this.app.getHttpServer());
    }
  }

  /**
   * Clean up database before each test
   */
  public async beforeEach() {
    try {
      if (!this._module) {
        await this.setup();
      }

      await this.clearDatabase();
    } catch (e) {
      console.log("Failed to clean up database for integration tests.", e);
      // Don't throw the error to allow tests to continue
    }
  }

  /**
   * Close the application after tests
   */
  public async teardown() {
    await this.clearDatabase();

    if (this.app) {
      await this.app.close();
      this.app = null;
    }

    // Close database connections
    await this.database.$client.end();

    // Clean up nock
    nock.cleanAll();
    nock.enableNetConnect();
  }

  /**
   * Clean up after each test
   */
  public afterEach() {
    // Any post-test cleanup that might be needed
  }

  /**
   * Access to the database instance
   */
  public get database(): DatabaseInstance {
    if (!this._module) {
      throw new Error("Call setup() before accessing the database.");
    }

    // Get the database instance from the module
    return this._module.get<DatabaseInstance>("DATABASE");
  }

  private async clearDatabase(): Promise<void> {
    // Clean up test data in correct order (respecting foreign key constraints)
    await this.database.delete(auditLogs).execute();
    await this.database.delete(experimentMembers).execute();
    await this.database.delete(experimentProtocols).execute();
    // Flows reference experiments, so delete flows before experiments
    await this.database.delete(flows).execute();
    await this.database.delete(experiments).execute();
    await this.database.delete(protocols).execute();
    await this.database.delete(profiles).execute();
    await this.database.delete(organizations).execute();
    await this.database.delete(users).execute();
  }

  /**
   * Create helper functions for making HTTP requests with authentication support
   */
  private request = (method: "get" | "post" | "put" | "patch" | "delete") => (url: string) => {
    if (!this._request) {
      throw new Error("Call setup() before making requests.");
    }

    const req = this._request[method](url);

    // Return a function that accepts an optional userId and mock session
    const extendedReq = Object.assign(req, {
      // Used for adding auth headers
      withAuth: (userId: string) => {
        // Add mock session to request
        req.set("Authorization", `Bearer test-token-for-${userId}`);
        // Mock the getSession function to return a session with the user
        this.mockUserSession(userId);
        return req;
      },
      withoutAuth: () => {
        // Ensure no auth headers
        req.unset("Authorization");
        // Mock getSession to return null (unauthorized)
        this.mockNoSession();
        return req;
      },
      // Used for typing response body type
      withResponseType: <T, _>() => {
        return req as request.Test & { body: T };
      },
    });

    return extendedReq;
  };

  // Mock the auth session for testing
  private mockUserSession(userId: string) {
    jest.spyOn(authExpress, "getSession").mockResolvedValue({
      user: {
        id: userId,
        name: "Test User",
        email: "test@example.com",
        registered: true,
      },
      expires: new Date(Date.now() + 60 * 1000).toISOString(),
    });
  }

  // Mock no session for unauthorized tests
  private mockNoSession() {
    jest.spyOn(authExpress, "getSession").mockResolvedValue(null);
  }

  // HTTP request methods
  public get: ReturnType<typeof this.request> = this.request("get");
  public post: ReturnType<typeof this.request> = this.request("post");
  public put: ReturnType<typeof this.request> = this.request("put");
  public patch: ReturnType<typeof this.request> = this.request("patch");
  public delete: ReturnType<typeof this.request> = this.request("delete");

  public get module() {
    if (!this._module) {
      throw new Error("Call setup() before accessing the module.");
    }
    return this._module;
  }

  public async createTestUser({
    email = faker.internet.email(),
    name = faker.person.fullName(),
    emailVerified = null,
    image = null,
  }: {
    email?: string;
    name?: string;
    emailVerified?: Date | null;
    image?: string | null;
  } = {}): Promise<string> {
    const [user] = await this.database
      .insert(users)
      .values({ email, name, emailVerified, image })
      .returning();
    return user.id;
  }

  /**
   * Helper to create an experiment for testing
   */
  public async createExperiment(data: {
    name: string;
    userId: string;
    description?: string;
    status?: "provisioning" | "provisioning_failed" | "active" | "stale" | "archived" | "published";
    visibility?: "private" | "public";
    embargoIntervalDays?: number;
  }) {
    const [experiment] = await this.database
      .insert(experiments)
      .values({
        name: data.name,
        description: data.description ?? "Test description",
        status: data.status ?? "provisioning",
        visibility: data.visibility ?? "private",
        embargoIntervalDays: data.embargoIntervalDays ?? 90,
        createdBy: data.userId,
      })
      .returning();

    const experimentAdmin = await this.addExperimentMember(experiment.id, data.userId, "admin");

    return { experiment, experimentAdmin };
  }

  /**
   * Helper to create an experiment membership
   */
  public async addExperimentMember(
    experimentId: string,
    userId: string,
    role: "admin" | "member" = "member",
  ) {
    const [membership] = await this.database
      .insert(experimentMembers)
      .values({
        experimentId,
        userId,
        role,
      })
      .returning();

    return membership;
  }

  /**
   * Helper to create a protocol for testing
   */
  public async createProtocol(data: {
    name: string;
    description?: string;
    code?: Record<string, unknown>[];
    family?: "multispeq" | "ambit";
    createdBy: string;
  }) {
    const [protocol] = await this.database
      .insert(protocols)
      .values({
        name: data.name,
        description: data.description ?? "Test protocol description",
        code: data.code ?? [{}],
        family: data.family ?? "multispeq",
        createdBy: data.createdBy,
      })
      .returning();
    return protocol;
  }

  /**
   * Helper to associate a protocol with an experiment
   */
  public async addExperimentProtocol(experimentId: string, protocolId: string, order = 0) {
    const [association] = await this.database
      .insert(experimentProtocols)
      .values({
        experimentId,
        protocolId,
        order,
      })
      .returning();
    return association;
  }

  /**
   * Helper to resolve path parameters
   */
  public resolvePath(path: string, params: Record<string, string>): string {
    return Object.entries(params).reduce((p, [key, value]) => p.replace(`:${key}`, value), path);
  }

  /**
   * Build a minimal valid Flow graph for tests.
   * Defaults to a single question node (yes_no) and no edges.
   * Options allow changing question kind and adding an instruction node + edge.
   */
  public sampleFlowGraph(options?: {
    questionKind?: "yes_no" | "open_ended" | "multi_choice";
    includeInstruction?: boolean;
  }) {
    const kind = options?.questionKind ?? "yes_no";

    const questionContent =
      kind === "yes_no"
        ? { kind: "yes_no" as const, text: "Q1" }
        : kind === "open_ended"
          ? { kind: "open_ended" as const, text: "Q1" }
          : { kind: "multi_choice" as const, text: "Q1", options: ["a", "b"] };

    const nodes: (
      | {
          id: string;
          type: "question";
          name: string;
          content: typeof questionContent;
          isStart?: boolean;
        }
      | {
          id: string;
          type: "instruction";
          name: string;
          content: { text: string };
          isStart?: boolean;
        }
    )[] = [
      {
        id: "n1",
        type: "question",
        name: "Q1",
        content: questionContent,
        isStart: true,
      },
    ];

    const edges: { id: string; source: string; target: string; label?: string | null }[] = [];

    if (options?.includeInstruction) {
      nodes.push({
        id: "n2",
        type: "instruction",
        name: "Read this",
        content: { text: "Note" },
        isStart: false,
      });
      edges.push({ id: "e1", source: "n1", target: "n2", label: "next" });
    }

    return { nodes, edges };
  }
}
