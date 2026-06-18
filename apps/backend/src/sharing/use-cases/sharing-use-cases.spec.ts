import { describe, expect, it, vi } from "vitest";

import type { AuthorizationService } from "../../authorization/authorization.service";
import { AppError, failure, success } from "../../common/utils/fp-utils";
import type { ResourceGrantRow, SharingRepository } from "../sharing.repository";
import { CreateResourceGrantUseCase } from "./create-resource-grant";
import { ListResourceGrantsUseCase } from "./list-resource-grants";
import { RevokeResourceGrantUseCase } from "./revoke-resource-grant";
import { UpdateResourceGrantUseCase } from "./update-resource-grant";

const allow = { allow: true as const, reason: "org-role" as const };
const denyForbidden = { allow: false as const, reason: "forbidden" as const };
const denyNotFound = { allow: false as const, reason: "not-found" as const };

const authzWith = (decision: unknown) =>
  ({ can: vi.fn().mockResolvedValue(decision) }) as unknown as AuthorizationService;

const repoWith = (methods: Partial<SharingRepository>) => methods as unknown as SharingRepository;

const grant: ResourceGrantRow = {
  id: "g1",
  resourceType: "experiment",
  resourceId: "r1",
  granteeType: "user",
  granteeId: "u1",
  role: "member",
  createdAt: new Date(),
  createdBy: "u0",
};

const body = { granteeType: "user" as const, granteeId: "u1", role: "member" };

function statusOf(result: { isFailure(): boolean; error?: AppError }) {
  return result.error?.statusCode ?? 0;
}

describe("ListResourceGrantsUseCase", () => {
  it("maps forbidden → 403 and not-found → 404", async () => {
    for (const [decision, code] of [
      [denyForbidden, 403],
      [denyNotFound, 404],
    ] as const) {
      const uc = new ListResourceGrantsUseCase(authzWith(decision), repoWith({}));
      expect(statusOf(await uc.execute("u", "experiment", "r"))).toBe(code);
    }
  });

  it("returns grants when read is allowed", async () => {
    const repo = repoWith({ list: vi.fn().mockResolvedValue(success([grant])) });
    const result = await new ListResourceGrantsUseCase(authzWith(allow), repo).execute(
      "u",
      "experiment",
      "r",
    );
    expect(result.isSuccess()).toBe(true);
  });
});

describe("CreateResourceGrantUseCase", () => {
  it("maps forbidden → 403 and not-found → 404", async () => {
    for (const [decision, code] of [
      [denyForbidden, 403],
      [denyNotFound, 404],
    ] as const) {
      const uc = new CreateResourceGrantUseCase(authzWith(decision), repoWith({}));
      expect(statusOf(await uc.execute("u", "experiment", "r", body))).toBe(code);
    }
  });

  it("400 when the grantee does not exist", async () => {
    const repo = repoWith({ granteeExists: vi.fn().mockResolvedValue(false) });
    expect(
      statusOf(
        await new CreateResourceGrantUseCase(authzWith(allow), repo).execute(
          "u",
          "experiment",
          "r",
          body,
        ),
      ),
    ).toBe(400);
  });

  it("propagates a list failure", async () => {
    const repo = repoWith({
      granteeExists: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue(failure(AppError.internal("db"))),
    });
    expect(
      statusOf(
        await new CreateResourceGrantUseCase(authzWith(allow), repo).execute(
          "u",
          "experiment",
          "r",
          body,
        ),
      ),
    ).toBe(500);
  });

  it("409 on a duplicate grantee", async () => {
    const repo = repoWith({
      granteeExists: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue(success([grant])),
    });
    expect(
      statusOf(
        await new CreateResourceGrantUseCase(authzWith(allow), repo).execute(
          "u",
          "experiment",
          "r",
          body,
        ),
      ),
    ).toBe(409);
  });

  it("propagates a create failure and 500s on empty insert", async () => {
    const base = {
      granteeExists: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue(success([])),
    };
    const fail = repoWith({
      ...base,
      create: vi.fn().mockResolvedValue(failure(AppError.internal("db"))),
    });
    expect(
      statusOf(
        await new CreateResourceGrantUseCase(authzWith(allow), fail).execute(
          "u",
          "experiment",
          "r",
          body,
        ),
      ),
    ).toBe(500);
    const empty = repoWith({ ...base, create: vi.fn().mockResolvedValue(success([])) });
    expect(
      statusOf(
        await new CreateResourceGrantUseCase(authzWith(allow), empty).execute(
          "u",
          "experiment",
          "r",
          body,
        ),
      ),
    ).toBe(500);
  });

  it("succeeds and returns the created grant", async () => {
    const repo = repoWith({
      granteeExists: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue(success([])),
      create: vi.fn().mockResolvedValue(success([grant])),
    });
    const result = await new CreateResourceGrantUseCase(authzWith(allow), repo).execute(
      "u",
      "experiment",
      "r",
      body,
    );
    expect(result.isSuccess()).toBe(true);
  });
});

describe("UpdateResourceGrantUseCase", () => {
  const updateBody = { role: "admin" as const };

  it("maps forbidden → 403 and not-found → 404", async () => {
    for (const [decision, code] of [
      [denyForbidden, 403],
      [denyNotFound, 404],
    ] as const) {
      const uc = new UpdateResourceGrantUseCase(authzWith(decision), repoWith({}));
      expect(statusOf(await uc.execute("u", "experiment", "r", "g1", updateBody))).toBe(code);
    }
  });

  it("propagates a findById failure", async () => {
    const repo = repoWith({
      findById: vi.fn().mockResolvedValue(failure(AppError.internal("db"))),
    });
    expect(
      statusOf(
        await new UpdateResourceGrantUseCase(authzWith(allow), repo).execute(
          "u",
          "experiment",
          "r",
          "g1",
          updateBody,
        ),
      ),
    ).toBe(500);
  });

  it("404 when the grant is missing", async () => {
    const repo = repoWith({ findById: vi.fn().mockResolvedValue(success([])) });
    expect(
      statusOf(
        await new UpdateResourceGrantUseCase(authzWith(allow), repo).execute(
          "u",
          "experiment",
          "r",
          "g1",
          updateBody,
        ),
      ),
    ).toBe(404);
  });

  it("propagates an update failure and 500s on empty update", async () => {
    const found = { findById: vi.fn().mockResolvedValue(success([grant])) };
    const fail = repoWith({
      ...found,
      updateRole: vi.fn().mockResolvedValue(failure(AppError.internal("db"))),
    });
    expect(
      statusOf(
        await new UpdateResourceGrantUseCase(authzWith(allow), fail).execute(
          "u",
          "experiment",
          "r",
          "g1",
          updateBody,
        ),
      ),
    ).toBe(500);
    const empty = repoWith({ ...found, updateRole: vi.fn().mockResolvedValue(success([])) });
    expect(
      statusOf(
        await new UpdateResourceGrantUseCase(authzWith(allow), empty).execute(
          "u",
          "experiment",
          "r",
          "g1",
          updateBody,
        ),
      ),
    ).toBe(500);
  });

  it("succeeds and returns the updated grant", async () => {
    const repo = repoWith({
      findById: vi.fn().mockResolvedValue(success([grant])),
      updateRole: vi.fn().mockResolvedValue(success([{ ...grant, role: "admin" }])),
    });
    const result = await new UpdateResourceGrantUseCase(authzWith(allow), repo).execute(
      "u",
      "experiment",
      "r",
      "g1",
      updateBody,
    );
    expect(result.isSuccess()).toBe(true);
    if (result.isSuccess()) {
      expect(result.value.role).toBe("admin");
    }
  });
});

describe("RevokeResourceGrantUseCase", () => {
  it("maps forbidden → 403 and not-found → 404", async () => {
    for (const [decision, code] of [
      [denyForbidden, 403],
      [denyNotFound, 404],
    ] as const) {
      const uc = new RevokeResourceGrantUseCase(authzWith(decision), repoWith({}));
      expect(statusOf(await uc.execute("u", "experiment", "r", "g1"))).toBe(code);
    }
  });

  it("propagates a findById failure", async () => {
    const repo = repoWith({
      findById: vi.fn().mockResolvedValue(failure(AppError.internal("db"))),
    });
    expect(
      statusOf(
        await new RevokeResourceGrantUseCase(authzWith(allow), repo).execute(
          "u",
          "experiment",
          "r",
          "g1",
        ),
      ),
    ).toBe(500);
  });

  it("404 when the grant is missing", async () => {
    const repo = repoWith({ findById: vi.fn().mockResolvedValue(success([])) });
    expect(
      statusOf(
        await new RevokeResourceGrantUseCase(authzWith(allow), repo).execute(
          "u",
          "experiment",
          "r",
          "g1",
        ),
      ),
    ).toBe(404);
  });

  it("propagates a delete failure", async () => {
    const repo = repoWith({
      findById: vi.fn().mockResolvedValue(success([grant])),
      deleteById: vi.fn().mockResolvedValue(failure(AppError.internal("db"))),
    });
    expect(
      statusOf(
        await new RevokeResourceGrantUseCase(authzWith(allow), repo).execute(
          "u",
          "experiment",
          "r",
          "g1",
        ),
      ),
    ).toBe(500);
  });

  it("succeeds", async () => {
    const repo = repoWith({
      findById: vi.fn().mockResolvedValue(success([grant])),
      deleteById: vi.fn().mockResolvedValue(success(undefined)),
    });
    const result = await new RevokeResourceGrantUseCase(authzWith(allow), repo).execute(
      "u",
      "experiment",
      "r",
      "g1",
    );
    expect(result.isSuccess()).toBe(true);
  });
});
