"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";

import type { ChartFormValues } from "../../charts/chart-config";

type DataSourcesFieldArray = UseFieldArrayReturn<ChartFormValues, "dataConfig.dataSources">;

const DataSourcesFieldArrayContext = createContext<DataSourcesFieldArray | null>(null);

/**
 * Owns the single `useFieldArray` instance for `dataConfig.dataSources`.
 * Multiple instances on one name path leave each others' internal `_fields`
 * cache stale on remove/append, which compounds with `shouldUnregister: false`
 * to produce phantom array entries.
 */
export function DataSourcesFieldArrayProvider({
  form,
  children,
}: {
  form: UseFormReturn<ChartFormValues>;
  children: ReactNode;
}) {
  const fieldArray = useFieldArray({
    control: form.control,
    name: "dataConfig.dataSources",
  });

  // Pre-register non-FormField keys so remove sees a complete row, then
  // drop the stale tail-position paths so `shouldUnregister: false` can't
  // re-materialise a phantom slot.
  const remove: DataSourcesFieldArray["remove"] = (index) => {
    const targets = Array.isArray(index) ? index : index === undefined ? [] : [index];
    for (const dsIndex of targets) {
      form.register(`dataConfig.dataSources.${dsIndex}.role` as const);
      form.register(`dataConfig.dataSources.${dsIndex}.tableName` as const);
      form.register(`dataConfig.dataSources.${dsIndex}.aggregate` as const);
    }
    fieldArray.remove(index);
    const newLength = form.getValues("dataConfig.dataSources").length;
    form.unregister([
      `dataConfig.dataSources.${newLength}.columnName` as const,
      `dataConfig.dataSources.${newLength}.alias` as const,
      `dataConfig.dataSources.${newLength}.errorColumn` as const,
      `dataConfig.dataSources.${newLength}.traceType` as const,
      `dataConfig.dataSources.${newLength}.axis` as const,
    ]);
  };

  return (
    <DataSourcesFieldArrayContext.Provider value={{ ...fieldArray, remove }}>
      {children}
    </DataSourcesFieldArrayContext.Provider>
  );
}

export function useDataSourcesFieldArray(): DataSourcesFieldArray {
  const value = useContext(DataSourcesFieldArrayContext);
  if (!value) {
    throw new Error("useDataSourcesFieldArray must be used within DataSourcesFieldArrayProvider");
  }
  return value;
}
