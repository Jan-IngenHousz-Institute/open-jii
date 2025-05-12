import { EditExperiment } from "@/components/edit-experiment";
import { getExperiment } from "@/util/experiments";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppLayout } from "@/components/app-layout";

type ParamsType = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: ParamsType;
}): Promise<Metadata> {
  const { id } = await params;
  const experiment = getExperiment(id);
  return {
    title: experiment ? experiment.name : "Experiment",
  };
}

export default async function ExperimentPage({
  params,
}: {
  params: ParamsType
}) {
  const { id } = await params;
  const experiment = getExperiment(id);
  if (!experiment) {
    notFound();
  }
  return (
    <AppLayout pageTitle={experiment.name}>
      <EditExperiment experiment={experiment} />
    </AppLayout>
  );
}
