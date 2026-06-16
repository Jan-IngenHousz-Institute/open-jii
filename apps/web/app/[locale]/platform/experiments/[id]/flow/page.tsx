"use client";

import { ErrorDisplay } from "@/components/error-display";
import { EmptyWorkbookState } from "@/components/experiment-flow/empty-workbook-state";
import { LinkedWorkbookCard } from "@/components/experiment-flow/linked-workbook-card";
import { FlowEditor } from "@/components/flow-editor/flow-editor";
import { PageContainer } from "@/components/page-container";
import { WorkbookEditor } from "@/components/workbook/workbook-editor";
import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useWorkbook } from "@/hooks/workbook/useWorkbook/useWorkbook";
import { GitBranch, List } from "lucide-react";
import { notFound } from "next/navigation";
import { use, useMemo } from "react";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { cellsToFlowGraph } from "@repo/api/utils/cells-to-flow";
import { useTranslation } from "@repo/i18n/client";
import { NavTabs, NavTabsContent, NavTabsList, NavTabsTrigger } from "@repo/ui/components/nav-tabs";
import { Skeleton } from "@repo/ui/components/skeleton";

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

  // Render the design from the workbook's LIVE cells so it reflects edits as the user builds it.
  // The experiment stays pinned to workbookVersionId (the runtime/data snapshot the card shows).
  const { data: workbookData } = useWorkbook(workbookId ?? "", { enabled: !!workbookId });

  const liveCells = useMemo<WorkbookCell[]>(() => {
    return (workbookData?.cells as WorkbookCell[] | undefined) ?? [];
  }, [workbookData]);

  const derivedFlow = useMemo(() => {
    if (liveCells.length === 0) return undefined;
    try {
      const graph = cellsToFlowGraph(liveCells);
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
  }, [liveCells, id]);

  if (isLoading || accessLoading) {
    return (
      <PageContainer width="fluid" className="space-y-8">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-96" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </PageContainer>
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
    return (
      <EmptyWorkbookState
        experimentId={id}
        experimentName={experimentData.name}
        hasAccess={hasAccess}
      />
    );
  }

  return (
    <PageContainer width="fluid" className="space-y-6">
      <LinkedWorkbookCard
        experimentId={id}
        locale={locale}
        workbookId={workbookId}
        workbookVersionId={workbookVersionId}
        hasAccess={hasAccess}
      />

      <NavTabs defaultValue="list">
        <NavTabsList>
          <NavTabsTrigger value="list">
            <List className="h-4 w-4" />
            {t("flow.viewList")}
          </NavTabsTrigger>
          <NavTabsTrigger value="graph">
            <GitBranch className="h-4 w-4" />
            {t("flow.viewGraph")}
          </NavTabsTrigger>
        </NavTabsList>

        <NavTabsContent value="list" className="mt-6">
          <WorkbookEditor cells={liveCells} onCellsChange={() => undefined} readOnly />
        </NavTabsContent>

        <NavTabsContent value="graph" className="mt-6">
          <FlowEditor initialFlow={derivedFlow} isDisabled />
        </NavTabsContent>
      </NavTabs>
    </PageContainer>
  );
}
