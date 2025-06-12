"use client";

import { useExperimentCreate } from "@/hooks/experiment/useExperimentCreate/useExperimentCreate";
import { useLocale } from "@/hooks/useLocale";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import type { CreateExperimentBody } from "@repo/api";
import { zCreateExperimentBody } from "@repo/api";
import { zExperimentVisibility } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Input,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectItem,
  SelectContent,
  RichTextarea,
  SelectValue,
  SelectTrigger,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

export function NewExperimentForm() {
  const router = useRouter();
  const { t } = useTranslation(undefined, "common");
  const locale = useLocale();

  const { mutate: createExperiment, isPending } = useExperimentCreate({
    onSuccess: () => {
      toast({
        description: t("experiments.experimentCreated"),
      });
      // Navigate to the experiment page with locale
      router.push(`/${locale}/platform/experiments`);
    },
  });

  const form = useForm<CreateExperimentBody>({
    resolver: zodResolver(zCreateExperimentBody),
    defaultValues: {
      name: "",
      description: "",
      visibility: zExperimentVisibility.enum.private,
      embargoIntervalDays: 90,
    },
  });

  function cancel() {
    router.back();
  }

  function onSubmit(data: CreateExperimentBody) {
    return createExperiment({ body: data });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newExperiment.name")}</FormLabel>
              <FormControl>
                <Input {...field} />
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
              <FormLabel>{t("newExperiment.description_field")}</FormLabel>
              <FormControl>
                <RichTextarea
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder={t("newExperiment.description_field")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newExperiment.visibility")}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("newExperiment.visibilityPlaceholder")}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(zExperimentVisibility.enum).map((key) => {
                    return (
                      <SelectItem key={key[0]} value={key[0]}>
                        {key[0]}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="embargoIntervalDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newExperiment.embargoIntervalDays")}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(event) => field.onChange(+event.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <Button type="button" onClick={cancel} variant="outline">
            {t("newExperiment.cancel")}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? t("newExperiment.creating")
              : t("newExperiment.finalizeSetup")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
