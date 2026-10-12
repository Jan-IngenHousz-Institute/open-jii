import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError, failure, success } from "../../../../common/utils/fp-utils";
import type { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { ListRecentlyOpenedExperimentsUseCase } from "./list-recently-opened-experiments";

describe("ListRecentlyOpenedExperimentsUseCase", () => {
  let repo: { findRecentlyOpened: ReturnType<typeof vi.fn> };
  let useCase: ListRecentlyOpenedExperimentsUseCase;

  beforeEach(() => {
    repo = { findRecentlyOpened: vi.fn() };
    useCase = new ListRecentlyOpenedExperimentsUseCase(repo as unknown as ExperimentRepository);
  });

  it("returns the repository's rows for the caller, limit and scope", async () => {
    const rows = [{ id: "exp-1", callerRole: "owner", openedAt: new Date() }];
    repo.findRecentlyOpened.mockResolvedValue(success(rows));

    const result = await useCase.execute("user-1", 3, "related");

    expect(repo.findRecentlyOpened).toHaveBeenCalledWith("user-1", 3, "related");
    expect(result.isSuccess()).toBe(true);
    if (result.isSuccess()) {
      expect(result.value).toBe(rows);
    }
  });

  it("passes a failed read back to the caller", async () => {
    repo.findRecentlyOpened.mockResolvedValue(failure(AppError.repositoryError()));

    const result = await useCase.execute("user-1", 3);

    expect(repo.findRecentlyOpened).toHaveBeenCalledWith("user-1", 3, undefined);
    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      expect(result.error.code).toBe("REPOSITORY_ERROR");
    }
  });
});
