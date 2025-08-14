"use client";

import { editExperimentFormSchema } from "@/util/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

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
  RichTextarea,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentUpdate } from "../../hooks/experiment/useExperimentUpdate/useExperimentUpdate";

interface ExperimentDetailsCardProps {
  experimentId: string;
  initialName: string;
  initialDescription: string;
}

export function ExperimentDetailsCard({
  experimentId,
  initialName,
  initialDescription,
}: ExperimentDetailsCardProps) {
  const { mutateAsync: updateExperiment, isPending: isUpdating } = useExperimentUpdate();
  const { t } = useTranslation();

  const form = useForm<{ name: string; description?: string }>({
    resolver: zodResolver(editExperimentFormSchema.pick({ name: true, description: true })),
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
        <CardDescription>{t("experimentSettings.generalDescription")}</CardDescription>
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
                      onBlur={(e) => {
                        // Trim whitespace from the input value
                        const trimmed = e.target.value.trim();
                        if (trimmed !== e.target.value) {
                          field.onChange(trimmed);
                        }
                        field.onBlur();
                      }}
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
                {isUpdating ? t("experimentSettings.saving") : t("experimentSettings.save")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
