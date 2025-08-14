"use client";

import { editProtocolFormSchema } from "@/util/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { UpdateProtocolRequestBody, SensorFamily } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  RichTextarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useProtocolUpdate } from "../../hooks/protocol/useProtocolUpdate/useProtocolUpdate";
import ProtocolCodeEditor from "../protocol-code-editor";

interface ProtocolDetailsCardProps {
  protocolId: string;
  initialName: string;
  initialDescription: string;
  initialCode: Record<string, unknown>[];
  initialFamily: SensorFamily;
}

export function ProtocolDetailsCard({
  protocolId,
  initialName,
  initialDescription,
  initialCode,
  initialFamily,
}: ProtocolDetailsCardProps) {
  const { mutateAsync: updateProtocol, isPending: isUpdating } = useProtocolUpdate(protocolId);
  const { t } = useTranslation();

  const form = useForm<UpdateProtocolRequestBody & { name: string; family: SensorFamily }>({
    resolver: zodResolver(
      editProtocolFormSchema.pick({ name: true, description: true, code: true, family: true }),
    ),
    defaultValues: {
      name: initialName,
      description: initialDescription,
      code: initialCode,
      family: initialFamily,
    },
  });

  async function onSubmit(
    data: UpdateProtocolRequestBody & { name: string; family: SensorFamily },
  ) {
    await updateProtocol({
      params: { id: protocolId },
      body: data,
    });
    toast({ description: t("protocols.protocolUpdated") });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("protocolSettings.generalSettings")}</CardTitle>
        <CardDescription>{t("protocolSettings.generalDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("protocolSettings.name")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value}
                      onBlur={(e) => {
                        // Trim whitespace from the input value
                        const trimmed = e.target.value.trim();
                        if (trimmed !== e.target.value) {
                          field.onChange(trimmed);
                        }
                        field.onBlur();
                      }}
                      placeholder={t("protocolSettings.name")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("protocolSettings.description")}</FormLabel>
                  <FormControl>
                    <RichTextarea
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder={t("protocolSettings.description")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="family"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("protocolSettings.family")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="multispeq">MultispeQ</SelectItem>
                      <SelectItem value="ambit" disabled>
                        Ambit (Coming Soon)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <h3 className="text-lg font-medium">{t("protocolSettings.code")}</h3>
              <p className="text-muted-foreground text-sm">
                {t("protocolSettings.codeDescription")}
              </p>
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ProtocolCodeEditor
                        value={field.value ?? [{}]}
                        onChange={field.onChange}
                        label=""
                        placeholder={t("protocolSettings.codePlaceholder")}
                        error={form.formState.errors.code?.message?.toString()}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? t("protocolSettings.saving") : t("protocolSettings.save")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
