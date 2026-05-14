import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import {
  DataSourcesFieldArrayProvider,
  useDataSourcesFieldArray,
} from "./data-sources-field-array-context";

function defaults(): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: lineChartType.defaultDataConfig(),
  };
}

interface HarnessResult {
  fieldArray: ReturnType<typeof useDataSourcesFieldArray>;
  form: UseFormReturn<ChartFormValues>;
}

function renderProvider() {
  const formRef: { current: UseFormReturn<ChartFormValues> | null } = { current: null };

  function Wrapper({ children }: { children: ReactNode }) {
    const form = useForm<ChartFormValues>({ defaultValues: defaults() });
    formRef.current = form;
    return <DataSourcesFieldArrayProvider form={form}>{children}</DataSourcesFieldArrayProvider>;
  }

  const { result } = renderHook<HarnessResult, void>(
    () => {
      const fieldArray = useDataSourcesFieldArray();
      if (!formRef.current) throw new Error("form did not mount");
      return { fieldArray, form: formRef.current };
    },
    { wrapper: Wrapper },
  );
  return result;
}

describe("DataSourcesFieldArrayContext", () => {
  it("throws when the hook is used outside the provider", () => {
    expect(() => renderHook(() => useDataSourcesFieldArray())).toThrow(
      /must be used within DataSourcesFieldArrayProvider/,
    );
  });

  it("exposes append/update/remove backed by RHF's useFieldArray", () => {
    const result = renderProvider();
    const before = result.current.form.getValues("dataConfig.dataSources").length;

    act(() => {
      result.current.fieldArray.append({
        tableName: "cells",
        columnName: "yield",
        role: "y",
      });
    });

    const after = result.current.form.getValues("dataConfig.dataSources");
    expect(after).toHaveLength(before + 1);
    expect(after[after.length - 1]).toMatchObject({ columnName: "yield", role: "y" });
  });

  it("remove drops the slot and leaves no phantom row at the former tail index", () => {
    const result = renderProvider();

    act(() => {
      result.current.fieldArray.append({ tableName: "cells", columnName: "a", role: "y" });
      result.current.fieldArray.append({ tableName: "cells", columnName: "b", role: "y" });
    });
    const afterAppend = result.current.form.getValues("dataConfig.dataSources");
    const lastIndex = afterAppend.length - 1;

    act(() => {
      result.current.fieldArray.remove(lastIndex);
    });

    const afterRemove = result.current.form.getValues("dataConfig.dataSources");
    expect(afterRemove).toHaveLength(afterAppend.length - 1);
    expect(afterRemove.at(-1)?.columnName).toBe("a");
  });
});
