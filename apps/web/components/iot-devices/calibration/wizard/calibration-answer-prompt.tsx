"use client";

import { formatList } from "@/components/calibrations/format-list";
import type { OperatorRequest } from "@/hooks/iot/useCalibrationOperator/useCalibrationOperator";
import { useLocale } from "@/hooks/useLocale";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";

const promptFormSchema = z.object({ answer: z.string() });

type PromptFormValues = z.infer<typeof promptFormSchema>;

type AnswerRequest = Exclude<OperatorRequest, { kind: "confirmReading" }>;

/** A request the operator answers: an instruction to acknowledge, or a value to type. */
export function CalibrationAnswerPrompt({ request }: { request: AnswerRequest }) {
  const { t } = useTranslation("iot");
  const locale = useLocale();
  const form = useForm<PromptFormValues>({
    resolver: zodResolver(promptFormSchema),
    defaultValues: { answer: "" },
  });

  const answer = form.watch("answer");
  const isGated = request.kind === "acknowledge" && request.confirm !== undefined;
  const isTokenTyped =
    request.kind === "acknowledge" && (request.confirm === undefined || answer === request.confirm);
  const isNumeric = request.kind === "readValue" && request.type === "number";
  const following = request.next?.reads ?? [];

  function submit(values: PromptFormValues) {
    if (request.kind === "acknowledge") {
      request.resolve(true);
      return;
    }
    if (!isNumeric) {
      request.resolve(values.answer);
      return;
    }
    // Whole-string parse: "142,92" must be refused, not recorded as 142.
    const text = values.answer.trim();
    const parsed = text === "" ? Number.NaN : Number(text);
    if (!Number.isFinite(parsed)) {
      form.setError("answer", { message: t("iot.calibration.prompt.invalidNumber") });
      return;
    }
    request.resolve(parsed);
  }

  function decline() {
    if (request.kind === "acknowledge") {
      request.resolve(false);
    }
  }

  // The readings follow the button without another prompt, so the operator has to have
  // everything set up before pressing it, not at some later step.
  function renderFollowing() {
    if (following.length === 0) {
      return null;
    }
    const columns = formatList(locale, following);
    return (
      <p className="text-muted-foreground text-sm">
        {request.kind === "acknowledge"
          ? t("iot.calibration.prompt.readsOnContinue", { columns })
          : t("iot.calibration.prompt.readsOnRecord", { columns })}
      </p>
    );
  }

  function renderField() {
    if (request.kind === "acknowledge" && !isGated) {
      return null;
    }
    return (
      <FormField
        control={form.control}
        name="answer"
        render={({ field }) => (
          // A confirmation token is a handful of characters and a reading is a number;
          // a field the width of the card invites neither.
          <FormItem className="max-w-xs">
            <FormLabel>
              {isGated
                ? t("iot.calibration.prompt.confirmLabel", { token: request.confirm ?? "" })
                : t("iot.calibration.prompt.valueLabel")}
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                autoFocus
                inputMode={isNumeric ? "decimal" : "text"}
                autoComplete="off"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4" aria-live="polite">
        <p className="text-sm font-medium">{request.prompt}</p>
        {renderFollowing()}
        {renderField()}
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={request.kind === "acknowledge" && !isTokenTyped}
          >
            {request.kind === "acknowledge"
              ? t("iot.calibration.prompt.continue")
              : t("iot.calibration.prompt.submit")}
          </Button>
          {request.kind === "acknowledge" && (
            <Button type="button" variant="outline" size="sm" onClick={decline}>
              {t("iot.calibration.prompt.decline")}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
