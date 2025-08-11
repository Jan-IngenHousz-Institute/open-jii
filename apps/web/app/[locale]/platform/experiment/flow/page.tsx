"use client";

import { NewExperimentFlow } from "~/components/new-experiment/new-experiment-flow";

export default function ExperimentFlowPage() {
  return (
    <div className="fixed inset-0 flex flex-col">
      <div className="flex-1 overflow-hidden">
        <NewExperimentFlow />
      </div>
    </div>
  );
}
