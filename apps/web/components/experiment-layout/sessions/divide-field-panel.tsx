import type { UseFormReturn } from "react-hook-form";

import type {
  DivideFieldBody,
  FieldShare,
  FieldSplit,
  Measurer,
} from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { zFieldSplit } from "@repo/api/domains/experiment/sessions/experiment-sessions.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@repo/ui/components/form";
import { Label } from "@repo/ui/components/label";
import { RadioGroup } from "@repo/ui/components/radio-group";
import { Switch } from "@repo/ui/components/switch";

import type { FieldPlan } from "./field-plan";
import type { FieldShares } from "./field-shares";
import { InviteMeasurer } from "./invite-measurer";
import { MeasurerPicker } from "./measurer-picker";
import { PaintControls } from "./paint-controls";
import { ShareCard } from "./share-card";
import { SplitOption } from "./split-option";

interface DivideFieldPanelProps {
  form: UseFormReturn<DivideFieldBody>;
  plan: FieldPlan;
  canEdit: boolean;
  measurers: Measurer[];
  shares: FieldShares;
  hasOtherMembers: boolean;
  isPainting: boolean;
  onPaintingChange: (isPainting: boolean) => void;
  paintInto: string | null;
  onPaintIntoChange: (userId: string | null) => void;
  canUndo: boolean;
  onUndo: () => void;
  onReset: () => void;
  /** Cuts the walk again for a new split or a new set of measurers. */
  onRecut: (split: FieldSplit, userIds: readonly string[]) => void;
}

export function DivideFieldPanel({
  form,
  plan,
  canEdit,
  measurers,
  shares,
  hasOtherMembers,
  isPainting,
  onPaintingChange,
  paintInto,
  onPaintIntoChange,
  canUndo,
  onUndo,
  onReset,
  onRecut,
}: DivideFieldPanelProps) {
  const { t } = useTranslation("fieldSessions");

  const isCoveredOnce = shares.coversOnce(plan.plots.map((plot) => plot.id));
  const canSave = canEdit && form.formState.isDirty && isCoveredOnce;

  // Scaffold: saving assignments is not built yet.
  const handleSave = form.handleSubmit(() => undefined);

  const changeSplit = (split: FieldSplit) => {
    form.setValue("split", split, { shouldDirty: true });
    onRecut(split, form.getValues("measurerIds"));
  };

  const changeMeasurers = (userIds: string[]) => {
    form.setValue("measurerIds", userIds, { shouldDirty: true });
    onRecut(form.getValues("split"), userIds);
  };

  const handleSplitChange = (value: string) => {
    const split = zFieldSplit.safeParse(value);
    if (split.success) {
      changeSplit(split.data);
    }
  };

  const renderSplit = (split: FieldSplit) => (
    <SplitOption
      key={split}
      split={split}
      plan={plan}
      measurerIds={form.watch("measurerIds")}
      isDisabled={!canEdit}
    />
  );

  const renderShare = (share: FieldShare) => (
    <ShareCard
      key={share.userId}
      plan={plan}
      name={shares.nameOf(share.userId)}
      style={shares.styleOf(share.userId)}
      unitIds={share.unitIds}
    />
  );

  if (!hasOtherMembers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("divide.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteMeasurer canInvite={canEdit} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("divide.title")}</CardTitle>
        <CardDescription>{t("divide.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-5" onSubmit={handleSave}>
            <FormField
              control={form.control}
              name="measurerIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("divide.measurers")}</FormLabel>
                  <FormControl>
                    <MeasurerPicker
                      measurers={measurers}
                      value={field.value}
                      onChange={changeMeasurers}
                      isDisabled={!canEdit}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="split"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("divide.split")}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={handleSplitChange}
                      disabled={!canEdit}
                      className="gap-2"
                    >
                      {zFieldSplit.options.map(renderSplit)}
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            {canEdit ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="paint-by-hand">{t("divide.paint")}</Label>
                  <Switch
                    id="paint-by-hand"
                    checked={isPainting}
                    onCheckedChange={onPaintingChange}
                  />
                </div>
                {isPainting ? (
                  <PaintControls
                    shares={shares}
                    paintInto={paintInto}
                    onPaintIntoChange={onPaintIntoChange}
                    canUndo={canUndo}
                    onUndo={onUndo}
                    onReset={onReset}
                  />
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3">{shares.shares.map(renderShare)}</div>

            {isCoveredOnce ? (
              <p className="text-muted-foreground text-sm">{t("divide.noOverlap")}</p>
            ) : null}

            {canEdit ? (
              <Button type="submit" disabled={!canSave}>
                {t("divide.save")}
              </Button>
            ) : null}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
