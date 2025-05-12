import { EditExperiment } from "@/components/edit-experiment";
import { AppLayout } from "@/components/app-layout";
import type { Metadata } from "next";

type ParamsType = Promise<{ id: string }>;

export const metadata: Metadata = {
  title: "Experiment",
}

export default async function ExperimentPage({
  params,
}: {
  params: ParamsType
}) {
  const { id } = await params;

  return (
    <AppLayout pageTitle={"Experiment"}>
      <EditExperiment experimentId={id} />
    </AppLayout>
  );
}
