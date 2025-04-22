import { INestApplication } from "@nestjs/common";
import { ModuleMetadata } from "@nestjs/common/interfaces";
import { Test, TestingModule } from "@nestjs/testing";
import { config } from "dotenv";
import { resolve } from "path";
import request from "supertest";

import {
  DatabaseInstance,
  experimentMembers,
  experiments,
  users,
  auditLogs,
  profiles,
} from "@repo/database";

import { AppModule } from "../app.module";

// Ensure test environment is loaded
config({ path: resolve(__dirname, "../../.env.test") });

export class TestHarness {
  private app: INestApplication | null = null;
  private static _appInstance: TestHarness | null = null;
  private readonly _imports: ModuleMetadata["imports"];
  private _module: TestingModule | null = null;
  private _request: ReturnType<typeof request> | null = null;

  private constructor(imports: ModuleMetadata["imports"]) {
    this._imports = imports;
  }

  public static get App() {
    return this._appInstance || (this._appInstance = new this([AppModule]));
  }

  /**
   * Set up the application for testing
   */
  public async setup() {
    if (!this.app) {
      this._module = await Test.createTestingModule({
        imports: this._imports,
      }).compile();

      this.app = this._module.createNestApplication();
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

      // Clean up test data in correct order (respecting foreign key constraints)
      await this.database.delete(auditLogs).execute();
      await this.database.delete(experimentMembers).execute();
      await this.database.delete(experiments).execute();
      await this.database.delete(profiles).execute();
      await this.database.delete(users).execute();
    } catch (e) {
      console.log("Failed to clean up database for integration tests.", e);
      // Don't throw the error to allow tests to continue
    }
  }

  /**
   * Close the application after tests
   */
  public async teardown() {
    if (this.app) {
      await this.app.close();
      this.app = null;
    }
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
    return this.module.get<DatabaseInstance>("DATABASE");
  }

  /**
   * Create helper functions for making HTTP requests
   */
  private request =
    (method: "get" | "post" | "patch" | "delete") =>
    (url: string, addUserId = true) => {
      if (!this._request) {
        throw new Error("Call setup() before making requests.");
      }

      const req = this._request[method](url);

      // Add userId query parameter if needed (simulating authentication)
      return addUserId ? req.query({ userId: this.testUserId }) : req;
    };

  // HTTP request methods
  public get = this.request("get");
  public post = this.request("post");
  public patch = this.request("patch");
  public delete = this.request("delete");

  public get module() {
    if (!this._module) {
      throw new Error("Call setup() before accessing the module.");
    }
    return this._module;
  }

  // Test data creation helpers
  private _testUserId: string | null = null;

  public async createTestUser(
    email: string = "test@example.com",
  ): Promise<string> {
    const [user] = await this.database
      .insert(users)
      .values({ email })
      .returning();
    this._testUserId = user.id; // Store the user ID in the instance property
    return user.id;
  }

  public get testUserId(): string {
    if (!this._testUserId) {
      throw new Error("Call createTestUser() before accessing testUserId");
    }
    return this._testUserId;
  }

  public set testUserId(id: string) {
    this._testUserId = id;
  }

  /**
   * Helper to create an experiment for testing
   */
  public async createExperiment(data: {
    name: string;
    description?: string;
    status?:
      | "provisioning"
      | "provisioning_failed"
      | "active"
      | "stale"
      | "archived"
      | "published";
    visibility?: "private" | "public";
    embargoIntervalDays?: number;
    userId?: string;
  }) {
    const userId = data.userId || this.testUserId;

    const [experiment] = await this.database
      .insert(experiments)
      .values({
        name: data.name,
        description: data.description || "Test description",
        status: data.status || "provisioning",
        visibility: data.visibility || "private",
        embargoIntervalDays: data.embargoIntervalDays || 90,
        createdBy: userId,
      })
      .returning();

    return experiment;
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
   * Helper to resolve path parameters
   */
  public resolvePath(path: string, params: Record<string, string>): string {
    return Object.entries(params).reduce(
      (p, [key, value]) => p.replace(`:${key}`, value),
      path,
    );
  }
}
