import { AppLayout } from "@/components/app-layout";
import { NewExperimentForm } from "@/components/new-experiment";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New experiment",
};

export default function NewExperimentPage() {
  return (
    <AppLayout pageTitle={"New experiment"}>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">New experiment</h3>
          <p className="text-muted-foreground text-sm">
            Set up a new experiment (project).
          </p>
        </div>
        <NewExperimentForm />
      </div>
    </AppLayout>
  );
}
