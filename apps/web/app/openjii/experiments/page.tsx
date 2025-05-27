import { ListExperiments } from "@/components/list-experiments";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@repo/auth/next";
import { Button } from "@repo/ui/components";

export const metadata: Metadata = {
  title: "Experiments",
};
export default async function ExperimentPage() {
  const session = await auth();
  const userId = session?.user?.id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium">Experiment</h1>
        <p>This page will show a list of existing experiments.</p>
      </div>
      <Link href="/openjii/experiments/new">
        <Button variant="outline">Create Experiment</Button>
      </Link>
      <ListExperiments userId={userId ?? ""} />
    </div>
  );
}
