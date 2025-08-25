"use client";

import { ArrowRight } from "lucide-react";

import type { Flow } from "@repo/api";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components";

interface StaticFlowViewerProps {
  flow: Flow;
  title?: string;
  description?: string;
  className?: string;
}

export function StaticFlowViewer({
  flow,
  title = "Experiment Flow",
  description = "Visual representation of your experiment flow",
  className = "",
}: StaticFlowViewerProps) {
  if (flow.graph.nodes.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground py-8 text-center">
          No flow configured for this experiment yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Simple list view of flow nodes */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Flow Steps:</h4>
          {flow.graph.nodes.map((node, index) => (
            <div key={node.id} className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className="bg-muted rounded px-2 py-1 font-mono text-sm">{index + 1}</span>
                <span className="text-sm font-medium">{node.name}</span>
                <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                  {node.type}
                </span>
                {node.isStart && (
                  <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">
                    Start
                  </span>
                )}
              </div>
              {typeof node.content === "object" && "text" in node.content && (
                <p className="text-muted-foreground mt-1 text-sm">
                  {(node.content as { text: string }).text}
                </p>
              )}
            </div>
          ))}
        </div>

        {flow.graph.edges.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Flow Connections:</h4>
            {flow.graph.edges.map((edge) => (
              <div key={edge.id} className="text-muted-foreground flex items-center gap-1 text-sm">
                {edge.source}
                <ArrowRight className="inline h-4 w-4" />
                {edge.target}
                {edge.label && ` (${edge.label})`}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
