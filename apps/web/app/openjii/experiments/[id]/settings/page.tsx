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
          Configure advanced settings and preferences for this experiment.
        </p>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border p-6">
          <h5 className="mb-4 text-base font-medium">
            Data Collection Settings
          </h5>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Auto-save data</label>
                <p className="text-muted-foreground text-xs">
                  Automatically save collected data
                </p>
              </div>
              <input type="checkbox" defaultChecked className="h-4 w-4" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">
                  Real-time monitoring
                </label>
                <p className="text-muted-foreground text-xs">
                  Enable live data visualization
                </p>
              </div>
              <input type="checkbox" defaultChecked className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-6">
          <h5 className="mb-4 text-base font-medium">Notifications</h5>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">
                  Email notifications
                </label>
                <p className="text-muted-foreground text-xs">
                  Send updates via email
                </p>
              </div>
              <input type="checkbox" className="h-4 w-4" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">
                  Push notifications
                </label>
                <p className="text-muted-foreground text-xs">
                  Send push notifications to devices
                </p>
              </div>
              <input type="checkbox" defaultChecked className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-6">
          <h5 className="mb-4 text-base font-medium">Data Retention</h5>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Retention Period
              </label>
              <select className="w-full rounded-md border p-2">
                <option value="30">30 days</option>
                <option value="90" selected>
                  90 days
                </option>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
                <option value="forever">Forever</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button className="rounded-md border px-4 py-2 hover:bg-gray-50">
            Reset to Defaults
          </button>
          <button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
