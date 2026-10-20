import { fromPartial } from "@total-typescript/shoehorn";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthorizationService } from "../../../../authorization/authorization.service";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import type { VisitRepository } from "../../../core/repositories/visit.repository";
import { RecordVisitUseCase } from "./record-visit";

describe("RecordVisitUseCase", () => {
  const authz = { can: vi.fn() };
  const repo = { record: vi.fn() };
  let useCase: RecordVisitUseCase;

  beforeEach(() => {
    vi.resetAllMocks();
    useCase = new RecordVisitUseCase(
      fromPartial<AuthorizationService>(authz),
      fromPartial<VisitRepository>(repo),
    );
  });

  it("records the visit when the caller can open the resource", async () => {
    authz.can.mockResolvedValue({ allow: true, reason: "public", organizationId: "org-1" });
    repo.record.mockResolvedValue(success(undefined));

    const result = await useCase.execute("user-1", "protocol", "protocol-1");

    assertSuccess(result);
    expect(authz.can).toHaveBeenCalledWith("user-1", {
      resourceType: "protocol",
      resourceId: "protocol-1",
      action: "read",
    });
    expect(repo.record).toHaveBeenCalledWith("user-1", "protocol", "protocol-1");
  });

  it("returns not-found without writing when the resource does not exist", async () => {
    authz.can.mockResolvedValue({ allow: false, reason: "not-found", organizationId: null });

    const result = await useCase.execute("user-1", "experiment", "missing");

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(repo.record).not.toHaveBeenCalled();
  });

  it("returns forbidden without writing when the caller cannot open it", async () => {
    authz.can.mockResolvedValue({ allow: false, reason: "forbidden", organizationId: "org-1" });

    const result = await useCase.execute("user-1", "workbook", "workbook-1");

    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(repo.record).not.toHaveBeenCalled();
  });

  it("passes a failed write back to the caller", async () => {
    authz.can.mockResolvedValue({ allow: true, reason: "org-role", organizationId: "org-1" });
    repo.record.mockResolvedValue(failure(AppError.repositoryError()));

    const result = await useCase.execute("user-1", "macro", "macro-1");

    assertFailure(result);
    expect(result.error.code).toBe("REPOSITORY_ERROR");
  });
});
