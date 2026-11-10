import { act, renderHook } from "@/test/test-utils";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { chartFormResolver, defaultAxisTypeFor, narrowChartConfig } from "./chart-config";
import type { ChartFormValues } from "./chart-config";
import { CATEGORY_PALETTE } from "./colors/palettes";

describe("chartFormResolver", () => {
  const values: ChartFormValues = {
    name: "Chart",
    chartFamily: "basic",
    chartType: "line",
    config: {},
    dataConfig: {
      tableName: "readings",
      dataSources: [{ tableName: "readings", columnName: "temp", role: "y" }],
    },
  };

  it("requires a data source even without a translation context", async () => {
    const { result } = renderHook(() =>
      useForm<ChartFormValues>({
        resolver: chartFormResolver,
        defaultValues: { ...values, dataConfig: { tableName: "readings", dataSources: [] } },
      }),
    );

    await act(async () => {
      expect(await result.current.trigger()).toBe(false);
    });

    expect(result.current.getFieldState("dataConfig.dataSources").error?.message).toBe(
      "workspace.validation.seriesRequired",
    );
  });

  it("reports multiple invalid filters as one translated shelf error", async () => {
    const { result } = renderHook(() =>
      useForm<ChartFormValues>({
        resolver: chartFormResolver,
        context: { translate: (key: string) => `translated: ${key}` },
        defaultValues: {
          ...values,
          dataConfig: {
            ...values.dataConfig,
            filters: [
              { column: "temp", operator: "between", value: [5] },
              { column: "temp", operator: "contains", value: 10 },
            ],
          },
        },
      }),
    );

    await act(async () => {
      expect(await result.current.trigger()).toBe(false);
    });

    expect(result.current.getFieldState("dataConfig.filters").error).toEqual({
      type: "custom",
      message: "translated: workspace.validation.invalidFilters",
      ref: undefined,
    });
  });

  it("allows empty series names and aliases so charts can use their default labels", async () => {
    const { result } = renderHook(() =>
      useForm<ChartFormValues>({
        resolver: chartFormResolver,
        defaultValues: {
          ...values,
          dataConfig: {
            ...values.dataConfig,
            dataSources: [
              { tableName: "readings", columnName: "temp", role: "y", seriesName: "", alias: "" },
            ],
          },
        },
      }),
    );

    await act(async () => {
      expect(await result.current.trigger()).toBe(true);
    });
  });
});

describe("narrowChartConfig", () => {
  it("returns the visualization's config when present", () => {
    const config = { colorMode: "categorical", barmode: "stack" };
    expect(narrowChartConfig({ config })).toMatchObject(config);
  });

  it("returns an empty config when missing", () => {
    expect(narrowChartConfig({})).toMatchObject({});
  });

  it("keeps the same object across calls, since the result is a prop", () => {
    // react-plotly compares config by reference, so a fresh object per render
    // would call Plotly.react on every render.
    const config = { colorMode: "continuous" as const };
    expect(narrowChartConfig({ config })).toBe(narrowChartConfig({ config }));
    expect(narrowChartConfig({})).toBe(narrowChartConfig({}));
  });

  it("pins the frozen palette, so a user's chart does not recolour on a theme toggle", () => {
    expect(narrowChartConfig({}).colorway).toBe(CATEGORY_PALETTE);
    expect(narrowChartConfig({ config: { barmode: "stack" } }).colorway).toBe(CATEGORY_PALETTE);
  });

  it("lets a stored config keep its own palette", () => {
    const config = { colorway: ["#111111"] };
    expect(narrowChartConfig({ config }).colorway).toEqual(["#111111"]);
  });
});

describe("defaultAxisTypeFor", () => {
  it("picks 'date' for temporal column types", () => {
    expect(defaultAxisTypeFor("TIMESTAMP")).toBe("date");
    expect(defaultAxisTypeFor("DATE")).toBe("date");
  });

  it("picks 'category' for string column types", () => {
    expect(defaultAxisTypeFor("STRING")).toBe("category");
  });

  it("picks 'category' for boolean column types", () => {
    expect(defaultAxisTypeFor("BOOLEAN")).toBe("category");
  });

  it("picks 'linear' for numeric column types", () => {
    expect(defaultAxisTypeFor("INT")).toBe("linear");
    expect(defaultAxisTypeFor("DOUBLE")).toBe("linear");
    expect(defaultAxisTypeFor("BIGINT")).toBe("linear");
  });

  it("picks 'linear' for an undefined column type", () => {
    expect(defaultAxisTypeFor(undefined)).toBe("linear");
  });

  it("picks 'linear' for an unrecognised type string", () => {
    expect(defaultAxisTypeFor("not-a-type")).toBe("linear");
  });
});
