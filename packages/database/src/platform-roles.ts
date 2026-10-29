import "dotenv/config";
import { parseArgs } from "node:util";

import { db } from "./postgres/database";
import {
  PLATFORM_ROLES,
  PlatformRoleError,
  changePlatformRole,
  isPlatformRole,
  listPlatformRoleAssignments,
} from "./postgres/platform-roles";

const usage = `Usage:
  platform-role grant  --role <${PLATFORM_ROLES.join("|")}> --target <user uuid> --actor <your user uuid>
  platform-role revoke --role <${PLATFORM_ROLES.join("|")}> --target <user uuid> --actor <your user uuid>
  platform-role list`;

// Deployed databases are reached only from the migration runner task, which the Platform Roles
// workflow starts after approval. The repository is public, so output names accounts by id only.
function assertReachableDatabase() {
  if (process.env.ECS_CONTAINER_METADATA_URI_V4) return;
  const host = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL).hostname
    : process.env.DB_HOST;
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host ?? "")) {
    throw new PlatformRoleError(
      "Refusing a database that is not local; run the Platform Roles workflow instead",
    );
  }
}

async function run(argv: string[]) {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { role: { type: "string" }, target: { type: "string" }, actor: { type: "string" } },
  });
  const [action] = positionals;
  assertReachableDatabase();

  if (action === "list") {
    const assignments = await listPlatformRoleAssignments(db);
    if (assignments.length === 0) console.log("No account holds a platform role");
    for (const assignment of assignments) {
      const roles = assignment.roles.map(
        (role) => `${role} since ${assignment.grantedAt[role]?.toISOString() ?? "unknown"}`,
      );
      // An inactive account's stored role grants nothing, but the review should still clear it.
      const state = assignment.active ? "" : " (inactive account, revoke to clear)";
      console.log(`${assignment.userId} ${roles.join(", ")}${state}`);
    }
    return;
  }
  if (action !== "grant" && action !== "revoke") throw new PlatformRoleError(usage);
  const { role, target, actor } = values;
  if (!role || !target || !actor) throw new PlatformRoleError(usage);
  if (!isPlatformRole(role)) throw new PlatformRoleError(usage);

  const roles = await changePlatformRole(db, {
    action,
    role,
    targetUserId: target,
    actorUserId: actor,
    source: "command",
    githubActor: process.env.PLATFORM_ROLE_GITHUB_ACTOR,
    githubTriggeringActor: process.env.PLATFORM_ROLE_GITHUB_TRIGGERING_ACTOR,
    githubRunId: process.env.PLATFORM_ROLE_GITHUB_RUN_ID,
    githubRunAttempt: process.env.PLATFORM_ROLE_GITHUB_RUN_ATTEMPT,
  });
  console.log(
    `${action === "grant" ? "Granted" : "Revoked"} ${role} for ${target.toLowerCase()}; ` +
      `it now holds ${roles.length > 0 ? roles.join(", ") : "no platform role"}`,
  );
}

async function main() {
  let exit = 0;
  try {
    await run(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof PlatformRoleError ? error.message : error);
    exit = error instanceof PlatformRoleError ? 2 : 1;
  } finally {
    await db.$client.end();
    process.exit(exit);
  }
}

void main();
