"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type {
  WalkingOrderSettings,
  WalkingStrategy,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import {
  zWalkingOrderSettings,
  zWalkingStrategy,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Form, FormControl, FormField, FormItem } from "@repo/ui/components/form";
import { RadioGroup } from "@repo/ui/components/radio-group";

import type { FieldPlan } from "./field-plan";
import { WalkingStrategyOption } from "./walking-strategy-option";

interface WalkingOrderCardProps {
  plan: FieldPlan;
  canEdit: boolean;
}

const RECOMMENDED: WalkingStrategy = "treatmentBalanced";

export function WalkingOrderCard({ plan, canEdit }: WalkingOrderCardProps) {
  const { t } = useTranslation("fieldSessions");

  const fallback: WalkingStrategy = plan.hasTreatments ? RECOMMENDED : "randomByBlock";
  const form = useForm<WalkingOrderSettings>({
    resolver: zodResolver(zWalkingOrderSettings),
    defaultValues: { strategy: plan.strategy ?? fallback, orderCode: plan.orderCode },
  });

  const isSaved = plan.strategy !== null;
  const canSave = !isSaved || form.formState.isDirty;

  // Scaffold: storing the strategy is not built yet.
  const handleSave = form.handleSubmit(() => undefined);

  const renderOption = (option: WalkingStrategy) => (
    <WalkingStrategyOption
      key={option}
      strategy={option}
      isRecommended={option === RECOMMENDED}
      isDisabled={!canEdit || (option === RECOMMENDED && !plan.hasTreatments)}
      needsTreatments={option === RECOMMENDED && !plan.hasTreatments}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("walkingOrder.title")}</CardTitle>
        <CardDescription>{t("walkingOrder.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-4" onSubmit={handleSave}>
            <FormField
              control={form.control}
              name="strategy"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!canEdit}
                      className="gap-2"
                    >
                      {zWalkingStrategy.options.map(renderOption)}
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            {canEdit ? (
              <Button type="submit" disabled={!canSave}>
                {t("walkingOrder.save")}
              </Button>
            ) : null}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
