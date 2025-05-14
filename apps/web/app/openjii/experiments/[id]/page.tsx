import { AppLayout } from "@/components/app-layout";
import { EditExperiment } from "@/components/edit-experiment";
import type { Metadata } from "next";

type ParamsType = Promise<{ id: string }>;

export const metadata: Metadata = {
  title: "Experiment",
};

export default async function ExperimentPage({
  params,
}: {
  params: ParamsType;
}) {
  const { id } = await params;

  return (
    <AppLayout pageTitle={"Experiment"}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">Experiment</h3>
            <p className="text-sm text-muted-foreground">
              You can edit your experiment here.
            </p>
          </div>
          <EditExperiment experimentId={id} />
        </div>
    </AppLayout>
  );
}
