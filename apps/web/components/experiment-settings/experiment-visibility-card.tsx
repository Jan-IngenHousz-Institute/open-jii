"use client";

import { editExperimentFormSchema } from "@/util/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentUpdate } from "../../hooks/experiment/useExperimentUpdate/useExperimentUpdate";

interface ExperimentVisibilityCardProps {
  experimentId: string;
  initialVisibility: "private" | "public";
  initialEmbargoIntervalDays: number;
}

export function ExperimentVisibilityCard({
  experimentId,
  initialVisibility,
  initialEmbargoIntervalDays,
}: ExperimentVisibilityCardProps) {
  const { mutateAsync: updateExperiment, isPending: isUpdating } = useExperimentUpdate();
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

  // TODO: Temporary removed as the implementation is pending on the backend
  // Watch visibility to conditionally display the embargo field
  // const visibility = form.watch("visibility");

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
        <CardDescription>{t("experimentSettings.generalDescription")}</CardDescription>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("experimentSettings.visibilityPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(zExperimentVisibility.enum).map((value) => (
                        <SelectItem key={value} value={value}>
                          {value.charAt(0).toUpperCase() + value.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* TODO: Temporary removed as the implementation is pending on the backend */}
            {/* Only show embargo settings when visibility is private */}
            {/*{visibility === "private" && (*/}
            {/*  <FormField*/}
            {/*    control={form.control}*/}
            {/*    name="embargoIntervalDays"*/}
            {/*    render={({ field }) => (*/}
            {/*      <FormItem>*/}
            {/*        <FormLabel>{t("experimentSettings.embargoIntervalDays")}</FormLabel>*/}
            {/*        <FormControl>*/}
            {/*          <Input*/}
            {/*            type="number"*/}
            {/*            {...field}*/}
            {/*            onChange={(e) => {*/}
            {/*              const value = Number(e.target.value);*/}
            {/*              if (value < 0) return field.onChange(0);*/}
            {/*              return field.onChange(value);*/}
            {/*            }}*/}
            {/*            value={field.value}*/}
            {/*          />*/}
            {/*        </FormControl>*/}
            {/*        <FormMessage />*/}
            {/*      </FormItem>*/}
            {/*    )}*/}
            {/*  />*/}
            {/*)}*/}

            <div className="flex justify-end">
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? t("experimentSettings.saving") : t("experimentSettings.save")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
