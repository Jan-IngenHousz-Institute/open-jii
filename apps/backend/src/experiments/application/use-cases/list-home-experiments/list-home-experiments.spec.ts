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

  it("lists related experiments without reading visits", async () => {
    const rows = [fromPartial<RelatedHomeExperimentRow>({ id: "unvisited", callerRole: "admin" })];
    repo.findRecentlyUpdatedRelated.mockResolvedValue(success(rows));

    const result = await useCase.execute("researcher", 5);

    assertSuccess(result);
    expect(repo.findRecentlyUpdatedRelated).toHaveBeenCalledWith("researcher", 5);
    expect(repo.findRecentlyOpened).not.toHaveBeenCalled();
    expect(result.value).toEqual({ experiments: rows });
  });

  it("reports a successful empty read as no related work", async () => {
    repo.findRecentlyUpdatedRelated.mockResolvedValue(success([]));

    const result = await useCase.execute("newcomer", 3);

    assertSuccess(result);
    expect(result.value).toEqual({ experiments: [] });
  });

  it("does not turn a failed read into first-work guidance", async () => {
    repo.findRecentlyUpdatedRelated.mockResolvedValue(failure(AppError.repositoryError()));

    const result = await useCase.execute("researcher", 3);

    assertFailure(result);
  });
});
