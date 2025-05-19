import { AppLayout } from "@/components/app-layout";
import type { Metadata } from "next";
import { NewExperimentForm } from "@/components/new-experiment";

export const metadata: Metadata = {
  title: "New experiment",
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewExperimentPage (
  { searchParams }: PageProps) {
  const { name, visibilityPrivate } = await searchParams;
  return (
    <AppLayout pageTitle={"New experiment"}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">New experiment</h3>
            <p className="text-sm text-muted-foreground">
              Set up a new experiment (project).
            </p>
          </div>
          <NewExperimentForm name={Array.isArray(name) ? name[0] : name} visibilityPrivate={Array.isArray(visibilityPrivate) ? visibilityPrivate[0] === "true" : visibilityPrivate === "true"} />
        </div>
    </AppLayout>
  );
}
