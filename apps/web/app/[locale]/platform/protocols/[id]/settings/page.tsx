import { ProtocolSettings } from "@/components/protocol-settings";

import type { Locale } from "@repo/i18n/config";
import initTranslations from "@repo/i18n/server";

interface ProtocolSettingsPageProps {
  params: Promise<{ id: string; locale: Locale }>;
}

export default async function ProtocolSettingsPage({ params }: ProtocolSettingsPageProps) {
  const { id, locale } = await params;

  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-lg font-medium">{t("protocols.settings")}</h4>
        <p className="text-muted-foreground text-sm">{t("protocols.settingsDescription")}</p>
      </div>

      <div className="space-y-6">
        <ProtocolSettings protocolId={id} />
      </div>
    </div>
  );
}
