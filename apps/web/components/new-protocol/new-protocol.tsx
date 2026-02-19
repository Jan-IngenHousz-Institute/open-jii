"use client";

import { useProtocolCreate } from "@/hooks/protocol/useProtocolCreate/useProtocolCreate";
import { useLocale } from "@/hooks/useLocale";
import { SENSOR_FAMILY_OPTIONS } from "@/util/sensor-family";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronsUpDown, MonitorX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useIotBrowserSupport } from "~/hooks/iot/useIotBrowserSupport";

import type { CreateProtocolRequestBody } from "@repo/api";
import { zCreateProtocolRequestBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  RichTextarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";
import { cn } from "@repo/ui/lib/utils";

import { IotProtocolRunner } from "../iot/iot-protocol-runner";
import ProtocolCodeEditor from "../protocol-code-editor";

export function NewProtocolForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const { t: tIot } = useTranslation("iot");
  const locale = useLocale();
  const [isCodeValid, setIsCodeValid] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const browserSupport = useIotBrowserSupport();

  const { mutate: createProtocol, isPending } = useProtocolCreate({
    onSuccess: (id: string) => router.push(`/${locale}/platform/protocols/${id}`),
  });

  const form = useForm<CreateProtocolRequestBody>({
    resolver: zodResolver(zCreateProtocolRequestBody),
    defaultValues: {
      name: "",
      description: "",
      code: [{}],
      family: "generic",
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

  const isDisabled = useMemo(() => {
    return isPending || !form.formState.isDirty || !form.formState.isValid || !isCodeValid;
  }, [isPending, form.formState.isDirty, form.formState.isValid, isCodeValid]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex h-[calc(100vh-14rem)] min-h-[400px] flex-col"
      >
        {/* Header */}
        <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-medium">{t("protocols.newProtocol")}</h3>
            <p className="text-muted-foreground truncate text-sm">{t("newProtocol.description")}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" onClick={cancel} variant="outline">
              {t("newProtocol.cancel")}
            </Button>
            <Button type="submit" disabled={isDisabled}>
              {isPending ? t("newProtocol.creating") : t("newProtocol.finalizeSetup")}
            </Button>
          </div>
        </div>

        {/* Split Panel Layout */}
        <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-lg border">
          {/* Left Panel - Protocol Details + Code Editor */}
          <ResizablePanel defaultSize={browserSupport.any ? 55 : 85} minSize={30}>
            <div className="h-full overflow-y-auto">
              <div className="flex h-full flex-col">
                {/* Collapsible Details Section */}
                <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                  <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between border-b px-4 py-2.5 transition-colors">
                    <span className="text-sm font-medium">{t("newProtocol.detailsTitle")}</span>
                    <ChevronsUpDown className="text-muted-foreground h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-4 border-b px-3 py-3 sm:px-4 sm:py-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("newProtocol.name")}</FormLabel>
                              <FormControl>
                                <Input {...field} trim />
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
                              <FormLabel>{t("newProtocol.family")}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t("newProtocol.selectFamily")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {SENSOR_FAMILY_OPTIONS.map((opt) => (
                                    <SelectItem
                                      key={opt.value}
                                      value={opt.value}
                                      disabled={opt.disabled}
                                    >
                                      {opt.label}
                                      {opt.disabled ? " (Coming Soon)" : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("newProtocol.description_field")}</FormLabel>
                            <FormControl>
                              <RichTextarea
                                value={field.value ?? ""}
                                onChange={field.onChange}
                                placeholder={t("newProtocol.description_field")}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Code Editor - fills remaining space */}
                <div className="min-h-[200px] flex-1">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <ProtocolCodeEditor
                        value={field.value}
                        onChange={field.onChange}
                        onValidationChange={setIsCodeValid}
                        label=""
                        placeholder={t("newProtocol.codePlaceholder")}
                        error={form.formState.errors.code?.message?.toString()}
                        height="100%"
                        borderless
                      />
                    )}
                  />
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Connect & Test */}
          <ResizablePanel
            defaultSize={browserSupport.any ? 30 : 15}
            minSize={browserSupport.any ? 20 : 10}
          >
            <div
              className={cn(
                "flex h-full min-w-0 flex-col overflow-hidden",
                !browserSupport.any && "bg-muted/30",
              )}
            >
              {/* Title bar matching Protocol Details header */}
              <div className="flex w-full items-center border-b px-2.5 py-2.5 sm:px-4">
                <span className="text-sm font-medium">{t("newProtocol.testerTitle")}</span>
              </div>
              <div className="flex flex-1 flex-col overflow-y-auto p-2.5 sm:p-4">
                {browserSupport.any ? (
                  <IotProtocolRunner
                    protocolCode={form.watch("code")}
                    sensorFamily={form.watch("family")}
                    protocolName={form.watch("name") || "Untitled Protocol"}
                    layout="vertical"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <MonitorX className="text-muted-foreground mx-auto mb-2 h-6 w-6" />
                      <div className="text-muted-foreground text-xs">
                        {tIot("iot.protocolRunner.browserNotSupported")}
                      </div>
                      <div className="text-muted-foreground/60 font-s">
                        {tIot("iot.protocolRunner.tryDifferentBrowser")}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </form>
    </Form>
  );
}
