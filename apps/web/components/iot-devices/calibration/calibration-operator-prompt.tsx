"use client";

import type { OperatorRequest } from "@/hooks/iot/useCalibrationOperator/useCalibrationOperator";
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

/**
 * The procedure's question to the person at the bench: an instruction to
 * acknowledge, sometimes gated on typing a token, or a value the rig cannot
 * measure. One request at a time; the interpreter is waiting on this.
 */
export function CalibrationOperatorPrompt({ request }: { request: OperatorRequest }) {
  const { t } = useTranslation("iot");
  const form = useForm<PromptFormValues>({
    resolver: zodResolver(promptFormSchema),
    defaultValues: { answer: "" },
  });

  const answer = form.watch("answer");
  const isGated = request.kind === "acknowledge" && request.confirm !== undefined;
  const isTokenTyped =
    request.kind === "acknowledge" && (request.confirm === undefined || answer === request.confirm);
  const isNumeric = request.kind === "readValue" && request.type === "number";

  function submit(values: PromptFormValues) {
    if (request.kind === "acknowledge") {
      request.resolve(true);
      return;
    }
    if (!isNumeric) {
      request.resolve(values.answer);
      return;
    }
    const parsed = Number.parseFloat(values.answer);
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

  function renderField() {
    if (request.kind === "acknowledge" && !isGated) {
      return null;
    }
    return (
      <FormField
        control={form.control}
        name="answer"
        render={({ field }) => (
          <FormItem>
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
        <p className="text-base">{request.prompt}</p>
        {renderField()}
        <div className="flex gap-2">
          <Button type="submit" disabled={request.kind === "acknowledge" && !isTokenTyped}>
            {request.kind === "acknowledge"
              ? t("iot.calibration.prompt.continue")
              : t("iot.calibration.prompt.submit")}
          </Button>
          {request.kind === "acknowledge" && (
            <Button type="button" variant="outline" onClick={decline}>
              {t("iot.calibration.prompt.decline")}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
