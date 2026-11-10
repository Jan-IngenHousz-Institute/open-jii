import { selectExperimentVisualizationSchema } from "../models/experiment-visualizations.model";

describe("saved visualization schema compatibility", () => {
  it.each([
    { functions: Array.from({ length: 51 }, () => ({ column: "value", function: "avg" })) },
    {
      functions: Array.from({ length: 11 }, (_, i) => ({
        column: "value",
        function: "previous",
        orderColumn: `time_${i}`,
      })),
    },
  ])("keeps existing chart data readable beyond ad-hoc query limits", ({ functions }) => {
    expect(
      selectExperimentVisualizationSchema.pick({ dataConfig: true }).safeParse({
        dataConfig: {
          tableName: "raw_data",
          dataSources: [{ tableName: "raw_data", columnName: "value", role: "y" }],
          aggregation: { functions },
        },
      }).success,
    ).toBe(true);
  });
});
