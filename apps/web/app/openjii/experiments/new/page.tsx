import { AppLayout } from "@/components/app-layout";
import { NewExperimentForm } from "@/components/new-experiment";
import type { SearchParamsType } from "@/util/searchParams";
import { getFirstSearchParam } from "@/util/searchParams";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New experiment",
};

interface PageProps {
  searchParams: SearchParamsType;
}

export default async function NewExperimentPage({ searchParams }: PageProps) {
  const { name, visibilityPrivate } = await searchParams;
  const nameParam = getFirstSearchParam(name);
  const visibilityPrivateParam =
    getFirstSearchParam(visibilityPrivate) === "true";
  return (
    <AppLayout pageTitle={"New experiment"}>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">New experiment</h3>
          <p className="text-muted-foreground text-sm">
            Set up a new experiment (project).
          </p>
        </div>
        <NewExperimentForm
          name={nameParam}
          visibilityPrivate={visibilityPrivateParam}
        />
      </div>
    </AppLayout>
  );
}
