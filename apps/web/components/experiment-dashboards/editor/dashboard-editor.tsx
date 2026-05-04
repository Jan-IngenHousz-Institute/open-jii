"use client";

import { useExperimentDashboard } from "@/hooks/experiment/useExperimentDashboard/useExperimentDashboard";
import { useLocale } from "@/hooks/useLocale";
import { AlertCircle, CheckCircle2, ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { FormProvider, useForm, useFieldArray } from "react-hook-form";

import type { ExperimentDashboard } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Form, FormControl, FormField, FormItem } from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";

import { AddWidgetButton } from "./add-widget-button";
import { DashboardCanvas } from "./dashboard-canvas";
import type { DashboardFormValues } from "./dashboard-form-values";
import {
  DashboardSaveProvider,
  useDashboardSaveStatus,
} from "./dashboard-save-context";
import { useDashboardAutosave } from "./use-dashboard-autosave";

interface DashboardEditorProps {
  experimentId: string;
  dashboardId: string;
}

export function DashboardEditor({ experimentId, dashboardId }: DashboardEditorProps) {
  const { t } = useTranslation("experimentDashboards");
  const { data, isLoading, error } = useExperimentDashboard(dashboardId, experimentId);

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex h-64 items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>{t("ui.messages.loading")}</span>
      </div>
    );
  }

  if (error || !data?.body) {
    return (
      <div className="text-muted-foreground bg-muted/30 rounded-md border border-dashed p-6 text-center">
        {t("ui.messages.loadFailed")}
      </div>
    );
  }

  return (
    <DashboardSaveProvider>
      <DashboardEditorInner
        experimentId={experimentId}
        dashboardId={dashboardId}
        dashboard={data.body}
      />
    </DashboardSaveProvider>
  );
}

interface DashboardEditorInnerProps {
  experimentId: string;
  dashboardId: string;
  dashboard: ExperimentDashboard;
}

function DashboardEditorInner({
  experimentId,
  dashboardId,
  dashboard,
}: DashboardEditorInnerProps) {
  const { t } = useTranslation("experimentDashboards");
  const locale = useLocale();

  const form = useForm<DashboardFormValues>({
    defaultValues: {
      name: dashboard.name,
      description: dashboard.description ?? "",
      layout: dashboard.layout,
      widgets: dashboard.widgets,
    },
  });

  const { append } = useFieldArray({
    control: form.control,
    // `id` is RHF's internal stable key; we keep widget.id as our own field
    // (separate from RHF's auto-generated id) so id-based lookups in the
    // canvas keep working.
    name: "widgets",
    keyName: "_rhfId",
  });

  useDashboardAutosave({ form, experimentId, dashboardId });

  const backHref = `/${locale}/platform/experiments/${experimentId}/dashboards/${dashboardId}`;

  return (
    <Form {...form}>
      <FormProvider {...form}>
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Link
                href={backHref}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
              >
                <ChevronLeft className="h-4 w-4" />
                {t("ui.actions.back")}
              </Link>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder={t("form.namePlaceholder")}
                        className="h-auto border-0 bg-transparent p-0 text-2xl font-bold tracking-tight shadow-none focus-visible:ring-0"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder={t("form.descriptionPlaceholder")}
                        rows={1}
                        className="text-muted-foreground min-h-0 resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="flex items-center gap-3">
              <SaveIndicator />
              <AddWidgetButton
                widgets={form.getValues("widgets")}
                columns={form.getValues("layout").columns}
                onAdd={(widget) => append(widget)}
              />
            </div>
          </div>

          <DashboardCanvas control={form.control} experimentId={experimentId} />
        </div>
      </FormProvider>
    </Form>
  );
}

function SaveIndicator() {
  const { isSaving, isDirty, hasError } = useDashboardSaveStatus();
  const { t } = useTranslation("experimentVisualizations");

  if (hasError) {
    return (
      <div className="flex items-center gap-2 text-[15px]">
        <AlertCircle className="text-destructive size-4" />
        <span className="text-destructive">{t("workspace.layout.saveFailed")}</span>
      </div>
    );
  }
  if (isSaving || isDirty) {
    return (
      <div className="flex items-center gap-2 text-[15px]">
        <Loader2 className="text-muted-foreground size-4 animate-spin" />
        <span>{t("workspace.layout.saving")}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-[15px]">
      <CheckCircle2 className="size-4 text-emerald-500" />
      <span className="text-muted-foreground">{t("workspace.layout.allChangesSaved")}</span>
    </div>
  );
}
