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
}

export function WalkingOrderCard({ plan }: WalkingOrderCardProps) {
  const { t } = useTranslation("fieldSessions");

  // Treatment-balanced needs treatments to balance.
  const strategies = zWalkingStrategy.options.filter(
    (option) => plan.hasTreatments || option !== "treatmentBalanced",
  );
  const fallback: WalkingStrategy = plan.hasTreatments ? "treatmentBalanced" : "randomByBlock";

  const form = useForm<WalkingOrderSettings>({
    resolver: zodResolver(zWalkingOrderSettings),
    defaultValues: { strategy: plan.strategy ?? fallback, seed: plan.seed },
  });

  // Scaffold: storing the strategy is not built yet.
  const handleSave = form.handleSubmit(() => undefined);

  const renderOption = (option: WalkingStrategy) => (
    <WalkingStrategyOption key={option} strategy={option} />
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
                      className="gap-2"
                    >
                      {strategies.map(renderOption)}
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            <Button type="submit">{t("walkingOrder.save")}</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
