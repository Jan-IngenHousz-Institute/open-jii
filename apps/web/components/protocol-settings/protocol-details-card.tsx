"use client";

import { editProtocolFormSchema } from "@/util/schema";
import { SENSOR_FAMILY_OPTIONS } from "@/util/sensor-family";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronsUpDown, MonitorX } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useIotBrowserSupport } from "~/hooks/iot/useIotBrowserSupport";

import type { UpdateProtocolRequestBody, SensorFamily } from "@repo/api";
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

import { useProtocolUpdate } from "../../hooks/protocol/useProtocolUpdate/useProtocolUpdate";
import { IotProtocolRunner } from "../iot/iot-protocol-runner";
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
  const { t: tIot } = useTranslation("iot");
  const [isCodeValid, setIsCodeValid] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const browserSupport = useIotBrowserSupport();

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
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex h-[calc(100vh-14rem)] min-h-[400px] flex-col"
      >
        {/* Header */}
        <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-medium">
              {t("protocolSettings.generalSettings")}
            </h3>
            <p className="text-muted-foreground truncate text-sm">
              {t("protocolSettings.generalDescription")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="submit"
              isLoading={isUpdating}
              disabled={
                isUpdating || !form.formState.isDirty || !form.formState.isValid || !isCodeValid
              }
            >
              {t("protocolSettings.save")}
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
                    <span className="text-sm font-medium">
                      {t("protocolSettings.detailsTitle")}
                    </span>
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
                              <FormLabel>{t("protocolSettings.name")}</FormLabel>
                              <FormControl>
                                <Input {...field} trim placeholder={t("protocolSettings.name")} />
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
                        value={field.value ?? [{}]}
                        onChange={field.onChange}
                        onValidationChange={setIsCodeValid}
                        label=""
                        placeholder={t("protocolSettings.codePlaceholder")}
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
              {/* Title bar */}
              <div className="flex w-full items-center border-b px-2.5 py-2.5 sm:px-4">
                <span className="text-sm font-medium">{t("protocolSettings.testerTitle")}</span>
              </div>
              <div className="flex flex-1 flex-col overflow-y-auto p-2.5 sm:p-4">
                {browserSupport.any ? (
                  <IotProtocolRunner
                    protocolCode={form.watch("code") ?? [{}]}
                    sensorFamily={form.watch("family")}
                    protocolName={form.watch("name")}
                    layout="vertical"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <MonitorX className="text-muted-foreground mx-auto mb-2 h-6 w-6" />
                      <div className="text-muted-foreground text-xs">
                        {tIot("iot.protocolRunner.browserNotSupported")}
                      </div>
                      <div className="text-muted-foreground/60 text-xs">
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
