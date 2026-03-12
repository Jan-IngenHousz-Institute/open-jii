"use client";

import { ErrorDisplay } from "@/components/error-display";
import { InlineEditableTitle } from "@/components/shared/inline-editable-title";
import { useMacro } from "@/hooks/macro/useMacro/useMacro";
import { useMacroUpdate } from "@/hooks/macro/useMacroUpdate/useMacroUpdate";
import { notFound, useParams } from "next/navigation";
import { parseApiError } from "~/util/apiError";

import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

interface MacroLayoutProps {
  children: React.ReactNode;
}

export default function MacroLayout({ children }: MacroLayoutProps) {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation(["macro", "common"]);
  const { t: tCommon } = useTranslation("common");
  const { data: session } = useSession();
  const { data: macroData, isLoading, error } = useMacro(id);
  const { mutateAsync: updateMacro, isPending: isUpdating } = useMacroUpdate(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">{tCommon("common.loading")}</div>
      </div>
    );
  }

  if (error) {
    const errorObj = error as { status?: number };
    const errorStatus = errorObj.status;

    if (errorStatus === 404 || errorStatus === 400) {
      notFound();
    }

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">{tCommon("errors.error")}</h3>
          <p className="text-muted-foreground text-sm">
            {tCommon("errors.resourceNotFoundMessage")}
          </p>
        </div>
        <ErrorDisplay error={error} />
      </div>
    );
  }

  if (!macroData) {
    return null;
  }

  const macro = macroData;
  const isCreator = session?.user.id === macro.createdBy;

  const handleTitleSave = async (newName: string) => {
    await updateMacro(
      {
        params: { id },
        body: { name: newName },
      },
      {
        onSuccess: () => {
          toast({ description: t("macros.macroUpdated") });
        },
        onError: (err) => {
          toast({ description: parseApiError(err)?.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <InlineEditableTitle
        name={macro.name}
        hasAccess={isCreator}
        onSave={handleTitleSave}
        isPending={isUpdating}
        badges={
          macro.sortOrder !== null ? (
            <Badge className="bg-secondary/30 text-primary">{tCommon("common.preferred")}</Badge>
          ) : undefined
        }
      />

      {children}
    </div>
  );
}
