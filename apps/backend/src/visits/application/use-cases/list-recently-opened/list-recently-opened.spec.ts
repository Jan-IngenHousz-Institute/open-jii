import { fromPartial } from "@total-typescript/shoehorn";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import type { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import type { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import type { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import type { WorkbookRepository } from "../../../../workbooks/core/repositories/workbook.repository";
import { ListRecentlyOpenedUseCase } from "./list-recently-opened";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

describe("ListRecentlyOpenedUseCase", () => {
  const experiments = { findRecentlyOpened: vi.fn() };
  const protocols = { findRecentlyOpened: vi.fn() };
  const macros = { findRecentlyOpened: vi.fn() };
  const workbooks = { findRecentlyOpened: vi.fn() };
  let useCase: ListRecentlyOpenedUseCase;

  beforeEach(() => {
    vi.resetAllMocks();
    experiments.findRecentlyOpened.mockResolvedValue(success([]));
    protocols.findRecentlyOpened.mockResolvedValue(success([]));
    macros.findRecentlyOpened.mockResolvedValue(success([]));
    workbooks.findRecentlyOpened.mockResolvedValue(success([]));
    useCase = new ListRecentlyOpenedUseCase(
      fromPartial<ExperimentRepository>(experiments),
      fromPartial<ProtocolRepository>(protocols),
      fromPartial<MacroRepository>(macros),
      fromPartial<WorkbookRepository>(workbooks),
    );
  });

  it("merges every type, newest visit first, up to the limit", async () => {
    const experimentOpenedAt = minutesAgo(1);
    experiments.findRecentlyOpened.mockResolvedValue(
      success([
        {
          id: "experiment-1",
          name: "Drought trial",
          status: "active",
          organizationName: "Plant Lab",
          openedAt: experimentOpenedAt,
          callerRole: "owner",
        },
      ]),
    );
    protocols.findRecentlyOpened.mockResolvedValue(
      success([
        {
          id: "protocol-1",
          name: "Dark adapted",
          family: "multispeq",
          openedAt: minutesAgo(3),
          callerRole: null,
        },
      ]),
    );
    workbooks.findRecentlyOpened.mockResolvedValue(
      success([
        {
          id: "workbook-1",
          name: "Leaf gas",
          latestVersion: 4,
          openedAt: minutesAgo(2),
          callerRole: "viewer",
        },
      ]),
    );

    const result = await useCase.execute("user-1", 2);

    assertSuccess(result);
    expect(result.value.items).toEqual([
      {
        type: "experiment",
        id: "experiment-1",
        name: "Drought trial",
        status: "active",
        organizationName: "Plant Lab",
        openedAt: experimentOpenedAt,
        callerRole: "owner",
      },
      expect.objectContaining({ type: "workbook", id: "workbook-1", latestVersion: 4 }),
    ]);
    expect(result.value.types).toEqual(["experiment", "protocol", "workbook"]);
    expect(experiments.findRecentlyOpened).toHaveBeenCalledWith("user-1", 2);
  });

  it("narrows the rows to one type but still reports every type", async () => {
    experiments.findRecentlyOpened.mockResolvedValue(
      success([
        {
          id: "experiment-1",
          name: "Drought trial",
          status: "active",
          organizationName: null,
          openedAt: minutesAgo(1),
          callerRole: "owner",
        },
      ]),
    );
    macros.findRecentlyOpened.mockResolvedValue(
      success([
        {
          id: "macro-1",
          name: "Efficiency",
          language: "python",
          openedAt: minutesAgo(5),
          callerRole: "member",
        },
      ]),
    );

    const result = await useCase.execute("user-1", 5, "macro");

    assertSuccess(result);
    expect(result.value.items).toEqual([expect.objectContaining({ type: "macro", id: "macro-1" })]);
    expect(result.value.types).toEqual(["experiment", "macro"]);
  });

  it("reports no rows and no types for a caller with no visits", async () => {
    const result = await useCase.execute("newcomer", 5);

    assertSuccess(result);
    expect(result.value).toEqual({ items: [], types: [] });
  });

  it("fails when any type fails to read", async () => {
    macros.findRecentlyOpened.mockResolvedValue(failure(AppError.repositoryError()));

    const result = await useCase.execute("user-1", 5);

    assertFailure(result);
    expect(result.error.code).toBe("REPOSITORY_ERROR");
  });
});
