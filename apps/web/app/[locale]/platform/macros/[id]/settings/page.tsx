"use client";

import { MacroSettings } from "@/components/macro-settings";
import { useMacro } from "@/hooks/macro/useMacro/useMacro";
import { use } from "react";

import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";

interface MacroSettingsPageProps {
  params: Promise<{ id: string }>;
}

export default function MacroSettingsPage({ params }: MacroSettingsPageProps) {
  const { id } = use(params);
  const { data: session } = useSession();
  const { data: macroData, isLoading } = useMacro(id);
  const { t } = useTranslation();

  // Show loading state
  if (isLoading) {
    return <div>{t("common.loading")}</div>;
  }

  // Check if user is authenticated
  if (!session?.user.id) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h4 className="text-lg font-medium">{t("errors.unauthorized")}</h4>
          <p className="text-muted-foreground text-sm">{t("errors.loginRequired")}</p>
        </div>
      </div>
    );
  }

  // Check if macro exists
  if (!macroData) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h4 className="text-lg font-medium">{t("macros.notFound")}</h4>
          <p className="text-muted-foreground text-sm">{t("macros.notFoundDescription")}</p>
        </div>
      </div>
    );
  }

  // Check if current user is the creator
  const isCreator = macroData.createdBy === session.user.id;

  if (!isCreator) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h4 className="text-lg font-medium">{t("errors.forbidden")}</h4>
          <p className="text-muted-foreground text-sm">{t("macros.onlyCreatorCanEdit")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-lg font-medium">{t("macros.settings")}</h4>
        <p className="text-muted-foreground text-sm">{t("macros.settingsDescription")}</p>
      </div>

      <div className="space-y-6">
        <MacroSettings macroId={id} />
      </div>
    </div>
  );
}
