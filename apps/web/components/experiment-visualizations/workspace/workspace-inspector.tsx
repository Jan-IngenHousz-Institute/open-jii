"use client";

import { Database, Palette } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentTableMetadata } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { useTranslation } from "@repo/i18n";
import { Card } from "@repo/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { cn } from "@repo/ui/lib/utils";

import type { ChartFormValues } from "../charts/chart-config";
import { DataTabContent } from "./tabs/data-tab-content";
import { StyleTabContent } from "./tabs/style-tab-content";

// An underline tab, not a pill. TabsTrigger's base carries `border
// border-transparent`, and a later `border-b-2` does not remove it: the
// border-width conflict table is one-directional, so `border-primary` (which is
// side-agnostic) coloured all four edges into a rectangle. `border-x-0
// border-t-0` is what actually leaves only the underline. `flex-none` undoes
// the base's `flex-1`, which silently defeated the list's `justify-start`.
// The dark overrides are the same story: they carry a `dark:` modifier, so the
// unmodified ones here never displaced them and they won on specificity too.
const tabTriggerClass = cn(
  "text-muted-foreground hover:text-foreground -mb-px flex-none gap-1.5 rounded-none border-x-0 border-b-2 border-t-0 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium shadow-none",
  "data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:border-primary data-[state=active]:shadow-none",
  "dark:data-[state=active]:border-primary dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-foreground",
);

interface WorkspaceInspectorProps {
  form: UseFormReturn<ChartFormValues>;
  experimentId: string;
  tables: ExperimentTableMetadata[];
  isTablesLoading?: boolean;
  tablesError?: unknown;
  selectedTableName: string;
  onTableChange: (tableName: string) => void;
  columns: ExperimentDataColumn[];
  isColumnsLoading: boolean;
  columnsError?: unknown;
}

export function WorkspaceInspector(props: WorkspaceInspectorProps) {
  return (
    <Card
      padding="none"
      // lg, not md: the inspector only becomes a column beside the chart at lg
      // (visualization-workspace.tsx). At md it was a full-width block that was
      // also sticky and internally scrolling, which is a nested-scroll trap.
      className="overflow-hidden shadow-none lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100vh-3rem)] lg:flex-col"
    >
      <WorkspaceInspectorBody {...props} bodyClassName="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col" />
    </Card>
  );
}

interface WorkspaceInspectorBodyProps extends WorkspaceInspectorProps {
  bodyClassName?: string;
}

export function WorkspaceInspectorBody({
  form,
  experimentId,
  tables,
  isTablesLoading = false,
  tablesError,
  selectedTableName,
  onTableChange,
  columns,
  isColumnsLoading,
  columnsError,
  bodyClassName,
}: WorkspaceInspectorBodyProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Controlled tab so chart-type swaps don't reset it.
  const [activeTab, setActiveTab] = useState<"data" | "style">("data");

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v === "style" ? "style" : "data")}
      className={cn("w-full", bodyClassName)}
    >
      <div className="border-b px-4 lg:shrink-0">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-0 bg-transparent p-0">
          <TabsTrigger value="data" className={tabTriggerClass}>
            <Database className="size-4" />
            {t("workspace.inspector.tabs.data")}
          </TabsTrigger>
          <TabsTrigger value="style" className={tabTriggerClass}>
            <Palette className="size-4" />
            {t("workspace.inspector.tabs.style")}
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="scrollbar-thin p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <TabsContent value="data" className="mt-0 space-y-6">
          <DataTabContent
            form={form}
            experimentId={experimentId}
            tables={tables}
            isTablesLoading={isTablesLoading}
            tablesError={tablesError}
            selectedTableName={selectedTableName}
            onTableChange={onTableChange}
            columns={columns}
            isColumnsLoading={isColumnsLoading}
            columnsError={columnsError}
          />
        </TabsContent>

        <TabsContent value="style" className="mt-0">
          <StyleTabContent form={form} columns={columns} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

export { DataTabContent } from "./tabs/data-tab-content";
export { StyleTabContent } from "./tabs/style-tab-content";

export const inspectorTabTriggerClass = tabTriggerClass;
