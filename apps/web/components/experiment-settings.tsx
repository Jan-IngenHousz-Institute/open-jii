"use client";

import { formatDate } from "@/util/date";
import { editExperimentFormSchema } from "@/util/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { Experiment } from "@repo/api";
import { zExperimentVisibility } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  RichTextarea,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperiment } from "../hooks/experiment/useExperiment/useExperiment";
import { useExperimentDelete } from "../hooks/experiment/useExperimentDelete/useExperimentDelete";
import { useExperimentUpdate } from "../hooks/experiment/useExperimentUpdate/useExperimentUpdate";
import { ExperimentMemberManagement } from "./experiment-member-management";

interface ExperimentSettingsProps {
  experimentId: string;
}

export function ExperimentSettings({ experimentId }: ExperimentSettingsProps) {
  const { data, isLoading } = useExperiment(experimentId);
  const { t } = useTranslation(undefined, "common");

  if (isLoading) {
    return <div>{t("experimentSettings.loading")}</div>;
  }

  if (!data) {
    return <div>{t("experimentSettings.notFound")}</div>;
  }

  const experiment = data.body;

  return (
    <div className="space-y-6">
      {/* Edit Experiment Details Card - First */}
      <ExperimentDetailsCard
        experimentId={experimentId}
        initialName={experiment.name}
        initialDescription={experiment.description ?? ""}
      />

      {/* Member Management and Visibility Settings - Side by Side */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ExperimentMemberManagement experimentId={experimentId} />
        <ExperimentVisibilityCard
          experimentId={experimentId}
          initialVisibility={experiment.visibility}
          initialEmbargoIntervalDays={experiment.embargoIntervalDays}
        />
      </div>

      {/* Experiment Info Card - Last */}
      <ExperimentInfoCard experimentId={experimentId} experiment={experiment} />
    </div>
  );
}

// ===== Experiment Details Card Component =====
interface ExperimentDetailsCardProps {
  experimentId: string;
  initialName: string;
  initialDescription: string;
}

function ExperimentDetailsCard({
  experimentId,
  initialName,
  initialDescription,
}: ExperimentDetailsCardProps) {
  const { mutateAsync: updateExperiment, isPending: isUpdating } =
    useExperimentUpdate();
  const { t } = useTranslation(undefined, "common");

  const form = useForm<{ name: string; description?: string }>({
    resolver: zodResolver(
      editExperimentFormSchema.pick({ name: true, description: true }),
    ),
    defaultValues: {
      name: initialName,
      description: initialDescription,
    },
  });

  async function onSubmit(data: { name: string; description?: string }) {
    await updateExperiment({
      params: { id: experimentId },
      body: data,
    });
    toast({ description: t("experiments.experimentUpdated") });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("experimentSettings.generalSettings")}</CardTitle>
        <CardDescription>
          {t("experimentSettings.generalDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("experimentSettings.name")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("experimentSettings.name")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("experimentSettings.description")}</FormLabel>
                  <FormControl>
                    <RichTextarea
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder={t("experimentSettings.description")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={isUpdating}>
                {isUpdating
                  ? t("experimentSettings.saving")
                  : t("experimentSettings.save")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ===== Experiment Visibility Card Component =====
interface ExperimentVisibilityCardProps {
  experimentId: string;
  initialVisibility: "private" | "public";
  initialEmbargoIntervalDays: number;
}

function ExperimentVisibilityCard({
  experimentId,
  initialVisibility,
  initialEmbargoIntervalDays,
}: ExperimentVisibilityCardProps) {
  const { mutateAsync: updateExperiment, isPending: isUpdating } =
    useExperimentUpdate();
  const { t } = useTranslation(undefined, "common");

  interface VisibilityFormValues {
    visibility?: "private" | "public";
    embargoIntervalDays?: number;
  }

  const form = useForm<VisibilityFormValues>({
    resolver: zodResolver(
      editExperimentFormSchema.pick({
        visibility: true,
        embargoIntervalDays: true,
      }),
    ),
    defaultValues: {
      visibility: initialVisibility,
      embargoIntervalDays: initialEmbargoIntervalDays,
    },
  });

  // Watch visibility to conditionally display the embargo field
  const visibility = form.watch("visibility");

  async function onSubmit(data: VisibilityFormValues) {
    // Skip the update if visibility is undefined
    if (data.visibility === undefined) {
      return;
    }

    const updateData = {
      visibility: data.visibility,
      // Only include embargoIntervalDays when visibility is private
      ...(data.visibility === "private" && {
        embargoIntervalDays: data.embargoIntervalDays,
      }),
    };

    await updateExperiment({
      params: { id: experimentId },
      body: updateData,
    });
    toast({ description: t("experiments.experimentUpdated") });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("experimentSettings.visibility")}</CardTitle>
        <CardDescription>
          {t("experimentSettings.generalDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("experimentSettings.visibility")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t(
                            "experimentSettings.visibilityPlaceholder",
                          )}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(zExperimentVisibility.enum).map(
                        (value) => (
                          <SelectItem key={value} value={value}>
                            {value.charAt(0).toUpperCase() + value.slice(1)}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Only show embargo settings when visibility is private */}
            {visibility === "private" && (
              <FormField
                control={form.control}
                name="embargoIntervalDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("experimentSettings.embargoIntervalDays")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={isUpdating}>
                {isUpdating
                  ? t("experimentSettings.saving")
                  : t("experimentSettings.save")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ===== Experiment Information and Deletion Card Component =====
interface ExperimentInfoCardProps {
  experimentId: string;
  experiment: Experiment; // Using any here for simplicity, should be properly typed in a real app
}

function ExperimentInfoCard({
  experimentId,
  experiment,
}: ExperimentInfoCardProps) {
  const { mutateAsync: deleteExperiment, isPending: isDeleting } =
    useExperimentDelete();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const router = useRouter();
  const { t } = useTranslation(undefined, "common");

  const handleDeleteExperiment = async () => {
    await deleteExperiment({ params: { id: experimentId } });
    toast({
      description: t("experiments.experimentDeleted"),
    });
    // Navigate to experiments list
    router.push("/platform/experiments");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("experimentSettings.generalSettings")}</CardTitle>
        <CardDescription>
          {t("experimentSettings.generalDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">
              {t("experimentSettings.created")} by:
            </span>{" "}
            {experiment.createdBy}
          </div>
          <div>
            <span className="font-medium">
              {t("experimentSettings.created")}:
            </span>{" "}
            {formatDate(experiment.createdAt)}
          </div>
          <div>
            <span className="font-medium">
              {t("experimentSettings.updated")}:
            </span>{" "}
            {formatDate(experiment.updatedAt)}
          </div>
        </div>

        <div className="border-t pt-4">
          <h5 className="text-destructive mb-2 text-base font-medium">
            {t("experimentSettings.dangerZone")}
          </h5>
          <p className="text-muted-foreground mb-4 text-sm">
            {t("experimentSettings.deleteWarning")}
          </p>

          {!showDeleteConfirm ? (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              {t("experimentSettings.deleteExperiment")}
            </Button>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-medium">
                {t("experimentSettings.confirmDelete")} "{experiment.name}"?{" "}
                {t("experimentSettings.deleteWarning")}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDeleteExperiment}
                  disabled={isDeleting}
                >
                  {isDeleting
                    ? t("experimentSettings.saving")
                    : t("experimentSettings.delete")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  {t("experimentSettings.cancel")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
