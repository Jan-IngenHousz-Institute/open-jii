import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthorizationService } from "../../../../authorization/authorization.service";
import { success } from "../../../../common/utils/fp-utils";
import type { VisibilityRepository } from "../../../core/repositories/visibility.repository";
import { SetVisibilityUseCase } from "./set-visibility";

describe("SetVisibilityUseCase", () => {
  let authz: { getOwnership: ReturnType<typeof vi.fn> };
  let repo: { setVisibility: ReturnType<typeof vi.fn> };
  let useCase: SetVisibilityUseCase;

  beforeEach(() => {
    authz = { getOwnership: vi.fn() };
    repo = { setVisibility: vi.fn() };
    useCase = new SetVisibilityUseCase(
      authz as unknown as AuthorizationService,
      repo as unknown as VisibilityRepository,
    );
  });

  it("publishes a private resource (private → public)", async () => {
    authz.getOwnership.mockResolvedValue({ organizationId: "org-1", visibility: "private" });
    repo.setVisibility.mockResolvedValue(success([{ id: "r-1", visibility: "public" }]));

    const result = await useCase.execute("experiment", "r-1", "public");

    expect(result.isSuccess()).toBe(true);
    if (result.isSuccess()) {
      expect(result.value).toEqual({ id: "r-1", visibility: "public" });
    }
    expect(repo.setVisibility).toHaveBeenCalledWith("experiment", "r-1", "public");
  });

  it("rejects public → private without touching the repository", async () => {
    authz.getOwnership.mockResolvedValue({ organizationId: "org-1", visibility: "public" });

    const result = await useCase.execute("macro", "r-2", "private");

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      expect(result.error.code).toBe("VISIBILITY_NOT_MONOTONIC");
    }
    expect(repo.setVisibility).not.toHaveBeenCalled();
  });

  it("treats a same-state request as a no-op (no write)", async () => {
    authz.getOwnership.mockResolvedValue({ organizationId: "org-1", visibility: "public" });

    const result = await useCase.execute("protocol", "r-3", "public");

    expect(result.isSuccess()).toBe(true);
    if (result.isSuccess()) {
      expect(result.value).toEqual({ id: "r-3", visibility: "public" });
    }
    expect(repo.setVisibility).not.toHaveBeenCalled();
  });

  it("returns not-found when the resource does not exist", async () => {
    authz.getOwnership.mockResolvedValue(null);

    const result = await useCase.execute("workbook", "missing", "public");

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(repo.setVisibility).not.toHaveBeenCalled();
  });
});
