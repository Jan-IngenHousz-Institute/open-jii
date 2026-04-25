"use client";

import { ErrorDisplay } from "@/components/error-display";
import { EmptyWorkbookState } from "@/components/experiment-flow/empty-workbook-state";
import { LinkedWorkbookCard } from "@/components/experiment-flow/linked-workbook-card";
import { FlowEditor } from "@/components/flow-editor/flow-editor";
import { WorkbookEditor } from "@/components/workbook/workbook-editor";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useWorkbookVersion } from "@/hooks/workbook/useWorkbookVersion/useWorkbookVersion";
import { GitBranch, List } from "lucide-react";
import { notFound } from "next/navigation";
import { use, useMemo } from "react";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { cellsToFlowGraph } from "@repo/api/utils/cells-to-flow";
import { useTranslation } from "@repo/i18n/client";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";

interface ExperimentDesignPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default function ExperimentDesignPage({ params }: ExperimentDesignPageProps) {
  const { id, locale } = use(params);
  const { data: experiment, isLoading, error } = useExperiment(id);
  const {
    data: accessData,
    isLoading: accessLoading,
    error: accessError,
  } = useExperimentAccess(id);
  const { t } = useTranslation("experiments");

  const experimentData = experiment?.body;
  const hasAccess = accessData?.body.isAdmin ?? false;
  const workbookId = experimentData?.workbookId;
  const workbookVersionId = experimentData?.workbookVersionId;

  // Fetch the pinned workbook version (immutable snapshot with cells)
  const { data: pinnedVersionData } = useWorkbookVersion(
    workbookId ?? "",
    workbookVersionId ?? "",
    { enabled: !!(workbookId && workbookVersionId) },
  );

  const versionedCells = useMemo<WorkbookCell[]>(() => {
    if (!pinnedVersionData) return [];
    return pinnedVersionData.cells as WorkbookCell[];
  }, [pinnedVersionData]);

  const derivedFlow = useMemo(() => {
    if (versionedCells.length === 0) return undefined;
    try {
      const graph = cellsToFlowGraph(versionedCells);
      if (graph.nodes.length === 0) return undefined;
      return {
        id: "derived",
        experimentId: id,
        graph,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch {
      return undefined;
    }
  }, [versionedCells, id]);

  if (isLoading || accessLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-96" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error ?? accessError) {
    return <ErrorDisplay error={error ?? accessError} title={t("failedToLoad")} />;
  }

  if (!experimentData || !accessData?.body.experiment) {
    return <div>{t("notFound")}</div>;
  }

  if (experimentData.status === "archived") {
    notFound();
  }

  if (!workbookId || !workbookVersionId) {
    return <EmptyWorkbookState experimentId={id} hasAccess={hasAccess} />;
  }

  return (
    <div className="space-y-6">
      <LinkedWorkbookCard
        experimentId={id}
        locale={locale}
        workbookId={workbookId}
        workbookVersionId={workbookVersionId}
        hasAccess={hasAccess}
      />

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">
            <List className="mr-1.5 h-4 w-4" />
            {t("flow.viewList")}
          </TabsTrigger>
          <TabsTrigger value="graph">
            <GitBranch className="mr-1.5 h-4 w-4" />
            {t("flow.viewGraph")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <WorkbookEditor cells={versionedCells} onCellsChange={() => undefined} readOnly />
        </TabsContent>

        <TabsContent value="graph" className="mt-6">
          <FlowEditor initialFlow={derivedFlow} isDisabled />
        </TabsContent>
      </Tabs>
    </div>
  );
}
