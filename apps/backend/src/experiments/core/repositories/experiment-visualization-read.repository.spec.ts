import { Logger } from "@nestjs/common";
import { fromPartial } from "@total-typescript/shoehorn";

import type { DatabaseInstance } from "@repo/database";

import {
  assertFailure,
  assertSuccess,
  AppError,
  failure,
  success,
} from "../../../common/utils/fp-utils";
import { ExperimentVisualizationRepository } from "./experiment-visualization.repository";

const validVisualization = () => ({
  id: crypto.randomUUID(),
  experimentId: crypto.randomUUID(),
  name: "Saved chart",
  description: null,
  chartFamily: "basic" as const,
  chartType: "bar" as const,
  config: {},
  dataConfig: {
    tableName: "raw_data",
    dataSources: [{ tableName: "raw_data", columnName: "value", role: "y" as const }],
  },
  createdBy: crypto.randomUUID(),
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("ExperimentVisualizationRepository readable rows", () => {
  const orderBy = vi.fn();
  const query = {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy,
  };
  const repository = new ExperimentVisualizationRepository(
    fromPartial<DatabaseInstance>({ select: vi.fn().mockReturnValue(query) }),
  );

  const malformedRows = [
    {
      title: "empty filter value",
      overrides: {
        dataConfig: {
          ...validVisualization().dataConfig,
          filters: [{ column: "school", operator: "equals", value: "" }],
        },
      },
      path: ["dataConfig", "filters", 0, "value"],
    },
    {
      title: "missing data sources",
      overrides: { dataConfig: { tableName: "raw_data" } },
      path: ["dataConfig", "dataSources"],
    },
    {
      title: "non-object chart config",
      overrides: { config: "unreadable" },
      path: ["config"],
    },
    {
      title: "invalid response metadata",
      overrides: { name: "" },
      path: ["name"],
    },
  ];

  it.each(malformedRows)("skips and logs a row with $title", async ({ overrides, path }) => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const first = validVisualization();
    const broken = { ...validVisualization(), ...overrides };
    const last = validVisualization();
    orderBy.mockResolvedValue(
      [first, broken, last].map((row) => ({
        experiment_visualizations: row,
        profileUserId: row.createdBy,
        firstName: "Chart",
        lastName: "Author",
      })),
    );

    const result = await repository.listVisualizations(first.experimentId);
    assertSuccess(result);
    expect(result.value).toEqual([
      { ...first, createdByName: "Chart Author" },
      { ...last, createdByName: "Chart Author" },
    ]);
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        msg: "Skipping unreadable experiment visualization",
        operation: "readExperimentVisualization",
        visualizationId: broken.id,
        experimentId: broken.experimentId,
      }),
    );
    expect(warn.mock.calls[0]?.[0]).toHaveProperty(
      "issues",
      expect.arrayContaining([expect.objectContaining({ path })]),
    );
  });

  it("returns an empty list when every row is unreadable", async () => {
    orderBy.mockResolvedValue(
      malformedRows.map(({ overrides }) => ({
        experiment_visualizations: { ...validVisualization(), ...overrides },
      })),
    );
    const result = await repository.listVisualizations(crypto.randomUUID());
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("logs the issue path and code without echoing an unrecognized property name", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const privateKey = "syntheticPrivateKey";
    const row = validVisualization();
    orderBy.mockResolvedValue([
      {
        experiment_visualizations: {
          ...row,
          dataConfig: {
            ...row.dataConfig,
            filters: [
              {
                column: "time",
                operator: "between",
                value: { last: 7, unit: "days", [privateKey]: true },
              },
            ],
          },
        },
      },
    ]);

    const result = await repository.listVisualizations(row.experimentId);
    assertSuccess(result);
    expect(result.value).toEqual([]);
    expect(warn.mock.calls[0]?.[0]).toHaveProperty("issues", [
      { path: ["dataConfig", "filters", 0, "value"], code: "unrecognized_keys" },
    ]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(privateKey);
  });

  it("keeps database failures as failures", async () => {
    orderBy.mockRejectedValueOnce(new Error("database unavailable"));
    assertFailure(await repository.listVisualizations(crypto.randomUUID()));
    const error = AppError.internal("database unavailable");
    vi.spyOn(repository, "findById").mockResolvedValueOnce(failure(error));
    const result = await repository.findReadableById(crypto.randomUUID());
    assertFailure(result);
    expect(result.error).toBe(error);
  });

  it("returns valid or missing single charts", async () => {
    const row = validVisualization();
    vi.spyOn(repository, "findById").mockResolvedValueOnce(success(row));
    const found = await repository.findReadableById(row.id);
    assertSuccess(found);
    expect(found.value).toEqual(row);

    vi.spyOn(repository, "findById").mockResolvedValueOnce(success(null));
    const missing = await repository.findReadableById(crypto.randomUUID());
    assertSuccess(missing);
    expect(missing.value).toBeNull();
  });

  it("logs and returns null for an unreadable single chart", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const broken = {
      ...validVisualization(),
      dataConfig: { tableName: "raw_data", dataSources: [] },
    };
    vi.spyOn(repository, "findById").mockResolvedValueOnce(success(broken));
    const result = await repository.findReadableById(broken.id);
    assertSuccess(result);
    expect(result.value).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        visualizationId: broken.id,
        experimentId: broken.experimentId,
      }),
    );
    expect(warn.mock.calls[0]?.[0]).toHaveProperty(
      "issues",
      expect.arrayContaining([expect.objectContaining({ path: ["dataConfig", "dataSources"] })]),
    );
  });
});
