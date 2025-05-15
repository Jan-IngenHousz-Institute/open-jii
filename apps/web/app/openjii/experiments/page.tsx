import { AppLayout } from "@/components/app-layout";
import { CreateExperiment } from "@/components/create-experiment";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Experiments",
};

export default function ExperimentPage() {
  return (
    <AppLayout pageTitle="Experiments">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Experiment</h3>
          <p>This page will show a list of existing experiments.</p>
        </div>
        <CreateExperiment />
      </div>
    </AppLayout>
  );
}
