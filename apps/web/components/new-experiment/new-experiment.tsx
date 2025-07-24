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
import { Button, Form } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { NewExperimentDetailsCard } from "./new-experiment-details-card";
import { NewExperimentFlow } from "./new-experiment-flow";
import { NewExperimentMembersCard } from "./new-experiment-members-card";
import { NewExperimentProtocolsCard } from "./new-experiment-protocols-card";
import { NewExperimentVisibilityCard } from "./new-experiment-visibility-card";

export function NewExperimentForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocale();

  const { mutate: createExperiment, isPending } = useExperimentCreate({
    onSuccess: (id: string) => router.push(`/${locale}/platform/experiments/${id}`),
  });

  const form = useForm<CreateExperimentBody>({
    resolver: zodResolver(zCreateExperimentBody),
    defaultValues: {
      name: "",
      description: "",
      visibility: zExperimentVisibility.enum.public,
      embargoIntervalDays: 90,
      members: [],
    },
  });

  function cancel() {
    router.back();
  }

  function onSubmit(data: CreateExperimentBody) {
    createExperiment({
      body: data,
    });
    toast({ description: t("experiments.experimentCreated") });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Card 1: Name & Description */}
        <NewExperimentDetailsCard form={form} />

        {/* Card 2: Add Members & Card 4: Visibility & Embargo (same row) */}
        <div className="flex flex-col gap-6 md:flex-row">
          <NewExperimentMembersCard form={form} />
          <NewExperimentVisibilityCard form={form} />
        </div>

        {/* Card 3: Add Protocols (new row) */}
        <div className="flex flex-col gap-6">
          <NewExperimentProtocolsCard form={form} />
        </div>

        {/* Experiment Flow Diagram */}
        <NewExperimentFlow />

        <div className="flex gap-2">
          <Button type="button" onClick={cancel} variant="outline">
            {t("newExperiment.cancel")}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? t("newExperiment.creating") : t("newExperiment.finalizeSetup")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
