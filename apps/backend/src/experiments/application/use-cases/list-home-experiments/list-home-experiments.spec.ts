import { fromPartial } from "@total-typescript/shoehorn";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import type {
  ExperimentRepository,
  RecentlyOpenedExperimentRow,
  RelatedHomeExperimentRow,
} from "../../../core/repositories/experiment.repository";
import { ListHomeExperimentsUseCase } from "./list-home-experiments";

describe("ListHomeExperimentsUseCase", () => {
  const repo = { findRecentlyOpened: vi.fn(), findRecentlyUpdatedRelated: vi.fn() };
  let useCase: ListHomeExperimentsUseCase;

  beforeEach(() => {
    vi.resetAllMocks();
    useCase = new ListHomeExperimentsUseCase(fromPartial<ExperimentRepository>(repo));
  });

  it("keeps genuine visits without padding from unvisited work", async () => {
    const visits = [
      fromPartial<RecentlyOpenedExperimentRow>({
        id: "visited",
        openedAt: new Date(),
        callerRole: "viewer",
      }),
    ];
    repo.findRecentlyOpened.mockResolvedValue(success(visits));
    const result = await useCase.execute("researcher", 3);
    assertSuccess(result);
    expect(result.value).toEqual({ source: "recently-opened", experiments: visits });
    expect(repo.findRecentlyOpened).toHaveBeenCalledWith("researcher", 3, "related");
    expect(repo.findRecentlyUpdatedRelated).not.toHaveBeenCalled();
  });

  it("falls back only after a successful empty eligible history read", async () => {
    const rows = [fromPartial<RelatedHomeExperimentRow>({ id: "unvisited", callerRole: "admin" })];
    repo.findRecentlyOpened.mockResolvedValue(success([]));
    repo.findRecentlyUpdatedRelated.mockResolvedValue(success(rows));
    const result = await useCase.execute("researcher", 2);
    assertSuccess(result);
    expect(repo.findRecentlyUpdatedRelated).toHaveBeenCalledWith("researcher", 2);
    expect(result.value).toEqual({ source: "related", experiments: rows });
    expect(result.value.experiments[0]).not.toHaveProperty("openedAt");
  });

  it("reports a successful empty fallback as no related work", async () => {
    repo.findRecentlyOpened.mockResolvedValue(success([]));
    repo.findRecentlyUpdatedRelated.mockResolvedValue(success([]));
    const result = await useCase.execute("newcomer", 3);
    assertSuccess(result);
    expect(result.value).toEqual({ source: "related", experiments: [] });
  });

  it("does not treat a failed visits read as empty or attempt fallback", async () => {
    repo.findRecentlyOpened.mockResolvedValue(failure(AppError.notFound("failed SQL")));
    const result = await useCase.execute("researcher", 3);
    assertFailure(result);
    expect(repo.findRecentlyUpdatedRelated).not.toHaveBeenCalled();
  });

  it("does not turn a failed fallback read into first-work guidance", async () => {
    repo.findRecentlyOpened.mockResolvedValue(success([]));
    repo.findRecentlyUpdatedRelated.mockResolvedValue(failure(AppError.repositoryError()));
    const result = await useCase.execute("researcher", 3);
    assertFailure(result);
  });
});
