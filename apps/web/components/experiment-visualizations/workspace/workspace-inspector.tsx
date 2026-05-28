"use client";

import { Database, Palette } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { DataColumn, ExperimentTableMetadata } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Card } from "@repo/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { cn } from "@repo/ui/lib/utils";

import type { ChartFormValues } from "../charts/chart-config";
import { DataTabContent } from "./tabs/data-tab-content";
import { StyleTabContent } from "./tabs/style-tab-content";

const tabTriggerClass = cn(
  "text-muted-foreground hover:text-foreground -mb-px gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium shadow-none",
  "data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:border-primary data-[state=active]:shadow-none",
);

interface WorkspaceInspectorProps {
  form: UseFormReturn<ChartFormValues>;
  experimentId: string;
  tables: ExperimentTableMetadata[];
  isTablesLoading?: boolean;
  tablesError?: unknown;
  selectedTableName: string;
  onTableChange: (tableName: string) => void;
  columns: DataColumn[];
  isColumnsLoading: boolean;
  columnsError?: unknown;
}

export function WorkspaceInspector(props: WorkspaceInspectorProps) {
  return (
    <Card className="overflow-hidden shadow-none md:sticky md:top-6 md:flex md:max-h-[calc(100vh-3rem)] md:flex-col">
      <WorkspaceInspectorBody {...props} bodyClassName="md:flex md:min-h-0 md:flex-1 md:flex-col" />
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
      <div className="border-b px-4 md:shrink-0">
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

      <div className="scrollbar-thin p-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
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
