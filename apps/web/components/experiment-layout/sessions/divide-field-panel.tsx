import { RefreshCw } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import type {
  DivideFieldBody,
  FieldShare,
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@repo/ui/components/form";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Switch } from "@repo/ui/components/switch";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";

import type { FieldPlan } from "./field-plan";
import type { FieldShares } from "./field-shares";
import { MeasurerPicker } from "./measurer-picker";
import { ShareCard } from "./share-card";

interface DivideFieldPanelProps {
  form: UseFormReturn<DivideFieldBody>;
  plan: FieldPlan;
  measurers: Measurer[];
  shares: FieldShares;
  isPainting: boolean;
  onPaintingChange: (isPainting: boolean) => void;
  paintInto: string | null;
  onPaintIntoChange: (userId: string | null) => void;
}

export function DivideFieldPanel({
  form,
  plan,
  measurers,
  shares,
  isPainting,
  onPaintingChange,
  paintInto,
  onPaintIntoChange,
}: DivideFieldPanelProps) {
  const { t } = useTranslation("fieldSessions");

  const isCoveredOnce = shares.coversOnce(plan.plots.map((plot) => plot.id));
  const measurerName = (userId: string) =>
    measurers.find((measurer) => measurer.userId === userId)?.name ?? userId;

  // Scaffold: saving assignments is not built yet.
  const handleSave = form.handleSubmit(() => undefined);
  const handlePaintIntoChange = (userId: string) => onPaintIntoChange(userId || null);

  const renderSplit = (split: DivideFieldBody["split"]) => (
    <SelectItem key={split} value={split}>
      {t(`divide.splits.${split}`)}
    </SelectItem>
  );

  const renderPaintTarget = (share: FieldShare) => (
    <ToggleGroupItem key={share.userId} value={share.userId} className="px-3">
      {measurerName(share.userId)}
    </ToggleGroupItem>
  );

  const renderShare = (share: FieldShare, index: number) => (
    <ShareCard
      key={share.userId}
      plan={plan}
      measurer={{ userId: share.userId, name: measurerName(share.userId) }}
      shareIndex={index}
      unitIds={share.unitIds}
    />
  );

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
                      onChange={field.onChange}
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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>{zFieldSplit.options.map(renderSplit)}</SelectContent>
                  </Select>
                  <FormDescription>{t(`divide.splitHints.${field.value}`)}</FormDescription>
                </FormItem>
              )}
            />

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
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm">{t("divide.paintHint")}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{t("divide.paintInto")}</span>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={paintInto ?? ""}
                      onValueChange={handlePaintIntoChange}
                    >
                      {shares.shares.map(renderPaintTarget)}
                    </ToggleGroup>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">{shares.shares.map(renderShare)}</div>

            {isCoveredOnce ? (
              <p className="text-muted-foreground text-sm">{t("divide.noOverlap")}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline">
                <RefreshCw className="size-4" />
                {t("divide.regenerate")}
              </Button>
              <Button type="submit">{t("divide.save")}</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
