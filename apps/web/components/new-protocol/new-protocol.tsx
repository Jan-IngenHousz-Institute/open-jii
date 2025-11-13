"use client";

import { useProtocolCreate } from "@/hooks/protocol/useProtocolCreate/useProtocolCreate";
import { useLocale } from "@/hooks/useLocale";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { CreateProtocolRequestBody } from "@repo/api";
import { zCreateProtocolRequestBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button, Form, FormField } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import ProtocolCodeEditor from "../protocol-code-editor";
import { NewProtocolDetailsCard } from "./new-protocol-details-card";

export function NewProtocolForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocale();
  const [isCodeValid, setIsCodeValid] = useState(true);

  const { mutate: createProtocol, isPending } = useProtocolCreate({
    onSuccess: (id: string) => router.push(`/${locale}/platform/protocols/${id}`),
  });

  const form = useForm<CreateProtocolRequestBody>({
    resolver: zodResolver(zCreateProtocolRequestBody),
    defaultValues: {
      name: "",
      description: "",
      code: [{}],
      family: "multispeq",
    },
  });

  function cancel() {
    router.back();
  }

  function onSubmit(data: CreateProtocolRequestBody) {
    createProtocol({
      body: {
        name: data.name,
        description: data.description,
        code: data.code,
        family: data.family,
      },
    });
    toast({ description: t("protocols.protocolCreated") });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <NewProtocolDetailsCard form={form} />

        <div className="space-y-2">
          <h3 className="text-lg font-medium">{t("newProtocol.codeTitle")}</h3>
          <p className="text-muted-foreground text-sm">{t("newProtocol.codeDescription")}</p>
          <div className="rounded-md border p-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <ProtocolCodeEditor
                  value={field.value}
                  onChange={field.onChange}
                  onValidationChange={setIsCodeValid}
                  label={t("newProtocol.code")}
                  placeholder={t("newProtocol.codePlaceholder")}
                  error={form.formState.errors.code?.message?.toString()}
                />
              )}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="button" onClick={cancel}>
            {t("newProtocol.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={
              isPending || !form.formState.isDirty || !form.formState.isValid || !isCodeValid
            }
            aria-label={
              isPending
                ? t("newProtocol.creating")
                : !form.formState.isDirty
                  ? "No changes to save"
                  : !isCodeValid
                    ? "Cannot save: Invalid JSON or protocol code"
                    : !form.formState.isValid
                      ? "Cannot save: Form has validation errors"
                      : t("newProtocol.finalizeSetup")
            }
          >
            {isPending ? t("newProtocol.creating") : t("newProtocol.finalizeSetup")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
