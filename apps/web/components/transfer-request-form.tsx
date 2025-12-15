"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTransferRequestCreate } from "~/hooks/useTransferRequestCreate/useTransferRequestCreate";

import { zCreateTransferRequestBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Checkbox,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@repo/ui/components";

const transferRequestSchema = zCreateTransferRequestBody.extend({
  consent: z.boolean().refine((val) => val === true, {
    message: "You must confirm ownership or permission",
  }),
});

type TransferRequestFormValues = z.infer<typeof transferRequestSchema>;

export function TransferRequestForm() {
  const { t } = useTranslation();
  const [isSuccess, setIsSuccess] = useState(false);
  const { mutate: createRequest, isPending } = useTransferRequestCreate({
    onSuccess: () => {
      setIsSuccess(true);
      form.reset();
    },
  });

  const form = useForm<TransferRequestFormValues>({
    resolver: zodResolver(transferRequestSchema),
    defaultValues: {
      projectIdOld: "",
      projectUrlOld: "",
      consent: false,
    },
  });

  const onSubmit = (data: TransferRequestFormValues) => {
    createRequest({ body: data });
  };

  if (isSuccess) {
    return (
      <Alert className="border-secondary/30 bg-secondary/10">
        <CheckCircle2 className="text-secondary h-4 w-4" />

        <AlertTitle className="text-foreground">{t("transferRequest.successTitle")}</AlertTitle>

        <AlertDescription className="text-muted-foreground">
          {t("transferRequest.successMessage")}
        </AlertDescription>

        <div className="col-span-full">
          <Button
            variant="outline"
            className="hover:bg-surface-light mt-4 w-full"
            onClick={() => setIsSuccess(false)}
          >
            {t("transferRequest.submitAnother")}
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="projectIdOld"
          disabled={isPending}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t("transferRequest.projectIdLabel")} <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder={t("transferRequest.projectIdPlaceholder")} {...field} />
              </FormControl>
              <FormDescription>{t("transferRequest.projectIdDescription")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="projectUrlOld"
          disabled={isPending}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t("transferRequest.projectUrlLabel")} <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder={t("transferRequest.projectUrlPlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormDescription>{t("transferRequest.projectUrlDescription")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="consent"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  disabled={isPending}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  {t("transferRequest.consentLabel")} <span className="text-destructive">*</span>
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("transferRequest.submitButton")}
        </Button>
      </form>
    </Form>
  );
}
