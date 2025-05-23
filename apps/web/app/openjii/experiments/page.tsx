import { AppLayout } from "@/components/app-layout";
import { CreateExperiment } from "@/components/create-experiment";
import { ListExperiments } from "@/components/list-experiments";
import type { Metadata } from "next";

import { auth } from "@repo/auth/next";

export const metadata: Metadata = {
  title: "Experiments",
};
export default async function ExperimentPage() {
  const session = await auth();
  const userId = session?.user?.id;

  return (
    <AppLayout pageTitle="Experiments">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Experiment</h3>
          <p>This page will show a list of existing experiments.</p>
        </div>
        <CreateExperiment />
        <ListExperiments userId={userId ?? ""} />
      </div>
    </AppLayout>
  );
}
