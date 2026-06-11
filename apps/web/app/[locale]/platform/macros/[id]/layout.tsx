"use client";

import { MacroLayoutContent } from "@/features/macros/components/macro-overview/macro-layout-content";
import { useMacro } from "@/features/macros/hooks/useMacro/useMacro";
import { EntityLayoutShell } from "@/shared/ui/entity-layout-shell";
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
