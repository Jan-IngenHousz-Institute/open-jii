import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as Roles from "./postgres/platform-roles";
import { PlatformRoleError } from "./postgres/platform-roles";

const mocks = vi.hoisted(() => ({ list: vi.fn(), change: vi.fn(), end: vi.fn() }));
vi.mock("./postgres/database", () => ({ db: { $client: { end: mocks.end } } }));
vi.mock("./postgres/platform-roles", async (importOriginal) => ({
  ...(await importOriginal<typeof Roles>()),
  listPlatformRoleAssignments: mocks.list,
  changePlatformRole: mocks.change,
}));

const originalArgv = process.argv;
let exit: MockInstance<typeof process.exit>;
let output: MockInstance<typeof console.log>;
let errors: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:15485/roles");
  vi.stubEnv("ECS_CONTAINER_METADATA_URI_V4", undefined);
  vi.stubEnv("DB_HOST", undefined);
  for (const key of ["ACTOR", "TRIGGERING_ACTOR", "RUN_ID", "RUN_ATTEMPT"]) {
    vi.stubEnv(`PLATFORM_ROLE_GITHUB_${key}`, undefined);
  }
  mocks.list.mockResolvedValue([]);
  mocks.change.mockResolvedValue(["platform_admin"]);
  mocks.end.mockResolvedValue(undefined);
  exit = vi.spyOn(process, "exit").mockImplementation(vi.fn<typeof process.exit>());
  output = vi.spyOn(console, "log").mockImplementation(vi.fn());
  errors = vi.spyOn(console, "error").mockImplementation(vi.fn());
});

afterEach(() => {
  process.argv = originalArgv;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function run(args: string[]) {
  process.argv = ["node", "platform-roles.ts", ...args];
  await import("./platform-roles.js");
  await vi.waitFor(() => expect(exit).toHaveBeenCalled());
  expect(mocks.end).toHaveBeenCalledOnce();
}

const args = (action = "grant", role = "platform_admin") => [
  action,
  "--role",
  role,
  "--target",
  "A0000000-0000-0000-0000-000000000001",
  "--actor",
  "b0000000-0000-0000-0000-000000000002",
];

describe("platform-role command", () => {
  it("lists an empty roster without changing a role", async () => {
    await run(["list"]);
    expect(output).toHaveBeenCalledWith("No account holds a platform role");
    expect(mocks.change).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("lists grant dates, unknown dates and inactive grants by account id", async () => {
    mocks.list.mockResolvedValue([
      {
        userId: "active",
        roles: ["platform_admin"],
        active: true,
        grantedAt: { platform_admin: new Date("2026-01-02T03:04:05Z") },
      },
      { userId: "inactive", roles: ["platform_admin"], active: false, grantedAt: {} },
    ]);
    await run(["list"]);
    expect(output.mock.calls).toEqual([
      ["active platform_admin since 2026-01-02T03:04:05.000Z"],
      ["inactive platform_admin since unknown (inactive account, revoke to clear)"],
    ]);
  });

  it.each(
    [[], ["unknown"], ["grant"], ["grant", "--role", "platform_admin"], args("grant", "admin")].map(
      (argv) => ({ argv }),
    ),
  )("refuses incomplete or unsupported commands %j", async ({ argv }) => {
    await run(argv);
    expect(errors).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(exit).toHaveBeenCalledWith(2);
    expect(mocks.change).not.toHaveBeenCalled();
  });

  it("reports parser errors and unexpected database failures as command failures", async () => {
    await run(["list", "--unknown"]);
    expect(errors).toHaveBeenCalledWith(expect.any(Error));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("reports an expected role refusal without a stack trace", async () => {
    mocks.change.mockRejectedValue(new PlatformRoleError("The actor is not active"));
    await run(args());
    expect(errors).toHaveBeenCalledWith("The actor is not active");
    expect(exit).toHaveBeenCalledWith(2);
  });

  it("reports an unexpected database failure and closes the client", async () => {
    const failure = new Error("connection failed");
    mocks.list.mockRejectedValue(failure);
    await run(["list"]);
    expect(errors).toHaveBeenCalledWith(failure);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it.each(["db.example.com", "", undefined])(
    "refuses a nonlocal or missing database host %s",
    async (host) => {
      vi.stubEnv("DATABASE_URL", undefined);
      vi.stubEnv("DB_HOST", host);
      await run(["list"]);
      expect(errors).toHaveBeenCalledWith(
        expect.stringContaining("Refusing a database that is not local"),
      );
      expect(exit).toHaveBeenCalledWith(2);
      expect(mocks.list).not.toHaveBeenCalled();
    },
  );

  it.each(["localhost", "127.0.0.1", "[::1]"])(
    "allows a loopback database URL at %s",
    async (host) => {
      vi.stubEnv("DATABASE_URL", `postgres://postgres:postgres@${host}:15485/roles`);
      await run(["list"]);
      expect(exit).toHaveBeenCalledWith(0);
    },
  );

  it("allows a loopback DB_HOST when DATABASE_URL is absent", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("DB_HOST", "::1");
    await run(["list"]);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("allows a deployed runner and passes workflow attribution through", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://postgres:postgres@private.example/roles");
    vi.stubEnv("ECS_CONTAINER_METADATA_URI_V4", "http://169.254.170.2/task");
    vi.stubEnv("PLATFORM_ROLE_GITHUB_ACTOR", "starter");
    vi.stubEnv("PLATFORM_ROLE_GITHUB_TRIGGERING_ACTOR", "rerunner");
    vi.stubEnv("PLATFORM_ROLE_GITHUB_RUN_ID", "123");
    vi.stubEnv("PLATFORM_ROLE_GITHUB_RUN_ATTEMPT", "2");
    await run(args());
    expect(mocks.change).toHaveBeenCalledWith(expect.anything(), {
      action: "grant",
      role: "platform_admin",
      targetUserId: args()[4],
      actorUserId: args()[6],
      source: "command",
      githubActor: "starter",
      githubTriggeringActor: "rerunner",
      githubRunId: "123",
      githubRunAttempt: "2",
    });
    expect(output).toHaveBeenCalledWith(
      "Granted platform_admin for a0000000-0000-0000-0000-000000000001; it now holds platform_admin",
    );
  });

  it("reports a revoke that leaves no role", async () => {
    mocks.change.mockResolvedValue([]);
    await run(args("revoke"));
    expect(output).toHaveBeenCalledWith(
      "Revoked platform_admin for a0000000-0000-0000-0000-000000000001; it now holds no platform role",
    );
  });
});
