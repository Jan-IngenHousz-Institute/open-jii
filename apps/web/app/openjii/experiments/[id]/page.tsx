import { NewExperiment } from "@/components/app-new-experiment";
import { getExperiment } from "@/util/experiments";
import { notFound } from "next/navigation";

export default async function ExperimentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const experiment = getExperiment(id);
  if (!experiment) {
    notFound();
  }
  return (
    <>
      <NewExperiment experiment={experiment} />
    </>
  );
}
