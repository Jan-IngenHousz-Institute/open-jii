import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, failure, success } from "../../../../common/utils/fp-utils";
import type { VisitRepository } from "../../../core/repositories/visit.repository";
import { RecordExperimentVisitUseCase } from "./record-experiment-visit";

describe("RecordExperimentVisitUseCase", () => {
  let authz: { can: ReturnType<typeof vi.fn> };
  let repo: { recordExperiment: ReturnType<typeof vi.fn> };
  let useCase: RecordExperimentVisitUseCase;

  beforeEach(() => {
    authz = { can: vi.fn() };
    repo = { recordExperiment: vi.fn() };
    useCase = new RecordExperimentVisitUseCase(
      authz as unknown as AuthorizationService,
      repo as unknown as VisitRepository,
    );
  });

  it("records the visit when the caller can open the experiment", async () => {
    authz.can.mockResolvedValue({ allow: true, reason: "public", organizationId: "org-1" });
    repo.recordExperiment.mockResolvedValue(success(undefined));

    const result = await useCase.execute("user-1", "exp-1");

    expect(result.isSuccess()).toBe(true);
    expect(authz.can).toHaveBeenCalledWith("user-1", {
      resourceType: "experiment",
      resourceId: "exp-1",
      action: "read",
    });
    expect(repo.recordExperiment).toHaveBeenCalledWith("user-1", "exp-1");
  });

  it("returns not-found without writing when the experiment does not exist", async () => {
    authz.can.mockResolvedValue({ allow: false, reason: "not-found", organizationId: null });

    const result = await useCase.execute("user-1", "missing");

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(repo.recordExperiment).not.toHaveBeenCalled();
  });

  it("returns forbidden without writing when the caller cannot open it", async () => {
    authz.can.mockResolvedValue({ allow: false, reason: "forbidden", organizationId: "org-1" });

    const result = await useCase.execute("user-1", "exp-1");

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
    expect(repo.recordExperiment).not.toHaveBeenCalled();
  });

  it("passes a failed write back to the caller", async () => {
    authz.can.mockResolvedValue({ allow: true, reason: "org-role", organizationId: "org-1" });
    repo.recordExperiment.mockResolvedValue(failure(AppError.repositoryError()));

    const result = await useCase.execute("user-1", "exp-1");

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      expect(result.error.code).toBe("REPOSITORY_ERROR");
    }
  });
});
