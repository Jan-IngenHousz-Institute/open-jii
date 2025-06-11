import { ExperimentSettings } from "@/components/experiment-settings";

import type { Locale } from "@repo/i18n/config";
import initTranslations from "@repo/i18n/server";

interface ExperimentSettingsPageProps {
  params: Promise<{ id: string; locale: Locale }>;
}

export default async function ExperimentSettingsPage({
  params,
}: ExperimentSettingsPageProps) {
  const { id, locale } = await params;

  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-lg font-medium">{t("experiments.settings")}</h4>
        <p className="text-muted-foreground text-sm">
          {t("experiments.settingsDescription")}
        </p>
      </div>

      <div className="space-y-6">
        <ExperimentSettings experimentId={id} />
      </div>
    </div>
  );
}
