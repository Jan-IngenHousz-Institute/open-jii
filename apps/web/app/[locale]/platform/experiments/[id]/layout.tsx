import { ExperimentLayoutShell } from "@/components/experiment-overview/experiment-layout-shell";
import { PrefetchedQueries } from "@/components/server-prefetch/prefetched-queries";
import { experimentAccessQuery } from "@/hooks/experiment/useExperimentAccess/experiment-access-query";
import type { ReactNode } from "react";
import { auth } from "~/app/actions/auth";

interface ExperimentLayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ExperimentLayout({ children, params }: ExperimentLayoutProps) {
  const [{ id }, session] = await Promise.all([params, auth()]);

  return (
    <PrefetchedQueries queries={(utils) => [experimentAccessQuery(utils, session?.user.id, id)]}>
      <ExperimentLayoutShell>{children}</ExperimentLayoutShell>
    </PrefetchedQueries>
  );
}
