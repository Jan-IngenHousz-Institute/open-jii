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
import { NewExperimentMembersCard } from "./new-experiment-members-card";
import { NewExperimentVisibilityCard } from "./new-experiment-visibility-card";

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
      visibility: zExperimentVisibility.enum.public,
      embargoIntervalDays: 90,
      members: [],
    },
  });

  function cancel() {
    router.back();
  }

  function onSubmit(data: CreateExperimentBody) {
    const payload = {
      ...data,
      members: (data.members ?? []).map((m) => ({
        userId: m.userId,
      })),
    };

    return createExperiment({
      body: payload,
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Card 1: Name & Description */}
        <NewExperimentDetailsCard form={form} />
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Card 2: Add Members */}
          <NewExperimentMembersCard form={form} />
          {/* Card 3: Visibility & Embargo */}
          <NewExperimentVisibilityCard form={form} />
        </div>
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
