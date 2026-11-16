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
import { WalkingAttributePicker } from "./walking-attribute-picker";
import { WalkingStrategyOption } from "./walking-strategy-option";

interface WalkingOrderCardProps {
  plan: FieldPlan;
  canEdit: boolean;
}

const RECOMMENDED: WalkingStrategy = "treatmentBalanced";

/** The strategies that read a plot attribute, and the setting that names it. */
const ATTRIBUTE_ROLES: Partial<Record<WalkingStrategy, "balanceOn" | "blocksFrom">> = {
  treatmentBalanced: "balanceOn",
  randomByBlock: "blocksFrom",
};

export function WalkingOrderCard({ plan, canEdit }: WalkingOrderCardProps) {
  const { t } = useTranslation("fieldSessions");

  const fallback: WalkingStrategy = plan.balanceName === null ? "random" : RECOMMENDED;
  const form = useForm<WalkingOrderSettings>({
    resolver: zodResolver(zWalkingOrderSettings),
    defaultValues: {
      strategy: plan.strategy ?? fallback,
      orderCode: plan.orderCode,
      balanceOn: plan.balanceName,
      blocksFrom: plan.blocksName,
    },
  });

  const isSaved = plan.strategy !== null;
  const canSave = !isSaved || form.formState.isDirty;

  // Scaffold: storing the strategy is not built yet.
  const handleSave = form.handleSubmit(() => undefined);

  const renderPicker = (role: "balanceOn" | "blocksFrom") => (
    <WalkingAttributePicker
      control={form.control}
      name={role}
      label={t(`walkingOrder.${role}`)}
      attributes={plan.attributeNames}
      isDisabled={!canEdit}
    />
  );

  const renderOption = (option: WalkingStrategy) => {
    const role = ATTRIBUTE_ROLES[option];
    const needsAttributes = role !== undefined && !plan.hasAttributes;

    return (
      <WalkingStrategyOption
        key={option}
        strategy={option}
        isRecommended={option === RECOMMENDED}
        isDisabled={!canEdit || needsAttributes}
        needsAttributes={needsAttributes}
        picker={role === undefined ? undefined : renderPicker(role)}
      />
    );
  };

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
