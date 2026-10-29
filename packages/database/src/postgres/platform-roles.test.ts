import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseInstance, Transaction } from "./database";
import {
  changePlatformRole,
  heldPlatformRoles,
  isActiveAccount,
  isPlatformRole,
  listPlatformRoleAssignments,
  listPlatformRoleHolders,
  platformRolesOf,
  PlatformRoleError,
} from "./platform-roles";
import type { PlatformRoleChange } from "./platform-roles";

const actorId = "a0000000-0000-0000-0000-000000000001";
const targetId = "b0000000-0000-0000-0000-000000000002";
const change: PlatformRoleChange = {
  action: "grant",
  role: "platform_admin",
  targetUserId: targetId,
  actorUserId: actorId,
  source: "command",
};
const active: {
  registered: boolean;
  isAnonymous: boolean;
  banned: boolean | null;
  deletedAt: Date | null;
} = {
  registered: true,
  isAnonymous: false,
  banned: false,
  deletedAt: null,
};
const actor = { id: actorId, role: "user", ...active };
const target = { id: targetId, role: "user", ...active };

function rowsQuery(rows: unknown[]) {
  const query = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    for: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (rows: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  for (const method of [
    query.from,
    query.leftJoin,
    query.where,
    query.orderBy,
    query.for,
    query.limit,
  ])
    method.mockReturnValue(query);
  return query;
}

function fixture(accounts = [actor, target]) {
  const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const values = vi.fn().mockResolvedValue(undefined);
  const select = vi
    .fn()
    .mockReturnValueOnce(rowsQuery([]))
    .mockReturnValueOnce(rowsQuery(accounts));
  const transaction = fromPartial<Transaction>({
    select,
    update: vi.fn().mockReturnValue({ set }),
    insert: vi.fn().mockReturnValue({ values }),
  });
  const database = fromPartial<DatabaseInstance>({
    transaction: (callback: (tx: Transaction) => Promise<unknown>) => callback(transaction),
  });
  return { database, set, values, select };
}

function roster(rows: unknown[], grants: unknown[] = []) {
  const select = vi
    .fn()
    .mockReturnValueOnce(rowsQuery(rows))
    .mockReturnValueOnce(rowsQuery(grants));
  return { database: fromPartial<DatabaseInstance>({ select }), select };
}

describe("platform role values", () => {
  it("recognizes only platform roles and removes duplicate, unknown and default values", () => {
    expect(isPlatformRole("platform_admin")).toBe(true);
    expect(isPlatformRole("admin")).toBe(false);
    for (const value of [null, undefined, "", "user", "unknown"])
      expect(platformRolesOf(value)).toEqual([]);
    expect(platformRolesOf("user, platform_admin, platform_admin,unknown")).toEqual([
      "platform_admin",
    ]);
  });

  it("requires a registered, unbanned and undeleted account", () => {
    expect(isActiveAccount(active)).toBe(true);
    expect(isActiveAccount({ ...active, banned: null })).toBe(true);
    expect(isActiveAccount({ ...active, registered: false })).toBe(false);
    expect(isActiveAccount({ ...active, banned: true })).toBe(false);
    expect(isActiveAccount({ ...active, deletedAt: new Date() })).toBe(false);
  });
});

describe("changing a platform role", () => {
  it("normalizes ids and records the grant and workflow attribution together", async () => {
    const { database, set, values } = fixture();
    expect(
      await changePlatformRole(database, {
        ...change,
        targetUserId: targetId.toUpperCase(),
        actorUserId: actorId.toUpperCase(),
        githubActor: "starter",
        githubTriggeringActor: "rerunner",
        githubRunId: "123",
        githubRunAttempt: "2",
      }),
    ).toEqual(["platform_admin"]);
    expect(set).toHaveBeenCalledWith({ role: "platform_admin" });
    expect(values).toHaveBeenCalledWith({
      userId: actorId,
      action: "platform_role.grant",
      details: {
        targetUserId: targetId,
        role: "platform_admin",
        source: "command",
        githubActor: "starter",
        githubTriggeringActor: "rerunner",
        githubRunId: "123",
        githubRunAttempt: "2",
      },
    });
  });

  it("records absent workflow attribution explicitly", async () => {
    const { database, values } = fixture();
    await changePlatformRole(database, change);
    expect(values).toHaveBeenCalledWith({
      userId: actorId,
      action: "platform_role.grant",
      details: {
        targetUserId: targetId,
        role: "platform_admin",
        source: "command",
        githubActor: null,
        githubTriggeringActor: null,
        githubRunId: null,
        githubRunAttempt: null,
      },
    });
  });

  it("allows revoking an inactive account's stored role", async () => {
    const { database, set } = fixture([actor, { ...target, role: "platform_admin", banned: true }]);
    expect(await changePlatformRole(database, { ...change, action: "revoke" })).toEqual([]);
    expect(set).toHaveBeenCalledWith({ role: "user" });
  });

  it.each([{ role: "admin" }, { targetUserId: "invalid" }, { actorUserId: "invalid" }])(
    "refuses invalid role or account ids before opening a transaction %j",
    async (overrides) => {
      const transaction = vi.fn();
      const database = fromPartial<DatabaseInstance>({ transaction });
      await expect(
        changePlatformRole(
          database,
          fromAny<PlatformRoleChange, unknown>({ ...change, ...overrides }),
        ),
      ).rejects.toBeInstanceOf(PlatformRoleError);
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it.each([
    { accounts: [target], message: "actor is not an active" },
    { accounts: [{ ...actor, registered: false }, target], message: "actor is not an active" },
    { accounts: [{ ...actor, banned: true }, target], message: "actor is not an active" },
    { accounts: [{ ...actor, deletedAt: new Date() }, target], message: "actor is not an active" },
    { accounts: [actor], message: "target is not an openJII" },
    { accounts: [actor, { ...target, registered: false }], message: "target is not an active" },
    { accounts: [actor, { ...target, banned: true }], message: "target is not an active" },
    { accounts: [actor, { ...target, deletedAt: new Date() }], message: "target is not an active" },
    { accounts: [actor, { ...target, role: "platform_admin" }], message: "already holds" },
  ])(
    "refuses $message without updating roles or auditing success",
    async ({ accounts, message }) => {
      const { database, set, values } = fixture(accounts);
      await expect(changePlatformRole(database, change)).rejects.toThrow(message);
      expect(set).not.toHaveBeenCalled();
      expect(values).not.toHaveBeenCalled();
    },
  );

  it("refuses a revoke when no role is held", async () => {
    const { database, set, values } = fixture();
    await expect(changePlatformRole(database, { ...change, action: "revoke" })).rejects.toThrow(
      "does not hold",
    );
    expect(set).not.toHaveBeenCalled();
    expect(values).not.toHaveBeenCalled();
  });

  it("does not report success when the audit write fails", async () => {
    const { database, values } = fixture();
    values.mockRejectedValue(new Error("audit unavailable"));
    await expect(changePlatformRole(database, change)).rejects.toThrow("audit unavailable");
  });
});

describe("reading platform roles", () => {
  it("does not read audit history when no recognized assignments exist", async () => {
    for (const accounts of [[], [{ ...target, role: "unknown" }]]) {
      const { database, select } = roster(accounts);
      expect(await listPlatformRoleAssignments(database)).toEqual([]);
      expect(select).toHaveBeenCalledOnce();
    }
  });

  it("uses the latest valid grant per holder and preserves unknown grant dates", async () => {
    const latest = new Date("2026-02-01T00:00:00Z");
    const older = new Date("2026-01-01T00:00:00Z");
    const { database } = roster(
      [
        { ...target, role: "platform_admin" },
        { ...actor, role: "platform_admin", banned: true },
      ],
      [
        { details: { targetUserId: targetId, role: "platform_admin" }, at: latest },
        { details: { targetUserId: targetId, role: "platform_admin" }, at: older },
        ...[
          null,
          "invalid",
          {},
          { targetUserId: targetId },
          { targetUserId: 1, role: "platform_admin" },
        ].map((details) => ({ details, at: older })),
      ],
    );
    expect(await listPlatformRoleAssignments(database)).toEqual([
      {
        userId: targetId,
        roles: ["platform_admin"],
        active: true,
        grantedAt: { platform_admin: latest },
      },
      { userId: actorId, roles: ["platform_admin"], active: false, grantedAt: {} },
    ]);
  });

  it("lists only active holders without the assignment activity field", async () => {
    const { database } = roster([
      { ...target, role: "platform_admin" },
      { ...actor, role: "platform_admin", banned: true },
    ]);
    expect(await listPlatformRoleHolders(database)).toEqual([
      { userId: targetId, roles: ["platform_admin"], grantedAt: {} },
    ]);
  });

  it.each(
    [
      [],
      [{ ...target, banned: true }],
      [{ ...target, registered: false }],
      [{ ...target, deletedAt: new Date() }],
    ].map((accounts) => ({ accounts })),
  )("returns no held roles for a missing or inactive account", async ({ accounts }) => {
    expect(await heldPlatformRoles(roster(accounts).database, targetId)).toEqual([]);
  });

  it("returns recognized held roles for an active account", async () => {
    expect(
      await heldPlatformRoles(
        roster([{ ...target, role: "user, platform_admin" }]).database,
        targetId,
      ),
    ).toEqual(["platform_admin"]);
  });
});
