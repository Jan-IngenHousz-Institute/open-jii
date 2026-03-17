"use client";

import { MacroLayoutContent } from "@/components/macro-overview/macro-layout-content";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useMacro } from "@/hooks/macro/useMacro/useMacro";
import { useParams } from "next/navigation";

import { useTranslation } from "@repo/i18n";

interface MacroLayoutProps {
  children: React.ReactNode;
}

export default function MacroLayout({ children }: MacroLayoutProps) {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("common");
  const { data, isLoading, error } = useMacro(id);

  return (
    <EntityLayoutShell
      isLoading={isLoading}
      error={error}
      hasData={!!data}
      loadingMessage={t("common.loading")}
    >
      {data && (
        <MacroLayoutContent id={id} macro={data}>
          {children}
        </MacroLayoutContent>
      )}
    </EntityLayoutShell>
  );
}
