import { use } from "react";

interface ExperimentSettingsPageProps {
  params: Promise<{ id: string }>;
}

export default function ExperimentSettingsPage({
  params,
}: ExperimentSettingsPageProps) {
  const { id } = use(params);
  // Will use params.id when implementing actual settings functionality

  return (
    <div className="space-y-8">
      <div>
        {id}
        <h4 className="text-lg font-medium">Experiment Settings</h4>
        <p className="text-muted-foreground text-sm">
          Manage settings and members for this experiment.
        </p>
      </div>

      <div className="space-y-6">
        <ExperimentMemberManagement experimentId={id} />
        <ExperimentSettings experimentId={id} />
      </div>
    </div>
  );
}
