"use client";

import { useProtocolCreate } from "@/hooks/protocol/useProtocolCreate/useProtocolCreate";
import { useLocale } from "@/hooks/useLocale";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import type { CreateProtocolRequestBody } from "@repo/api";
import { zCreateProtocolRequestBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Form,
  FormField,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { IotProtocolTester } from "../iot/iot-protocol-tester";
import ProtocolCodeEditor from "../protocol-code-editor";
import { NewProtocolDetailsCard } from "./new-protocol-details-card";

export function NewProtocolForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocale();
  const [isCodeValid, setIsCodeValid] = useState(true);
  const [view, setView] = useState<"form" | "tester">("form");
  const [browserSupport, setBrowserSupport] = useState<{
    bluetooth: boolean;
    serial: boolean;
  }>({ bluetooth: false, serial: false });

  useEffect(() => {
    // Check browser support for Web Bluetooth and Serial APIs
    setBrowserSupport({
      bluetooth: typeof navigator !== "undefined" && "bluetooth" in navigator,
      serial: typeof navigator !== "undefined" && "serial" in navigator,
    });
  }, []);

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

  const isDisabled = useMemo(() => {
    return isPending || !form.formState.isDirty || !form.formState.isValid || !isCodeValid;
  }, [isPending, form.formState.isDirty, form.formState.isValid, isCodeValid]);

  if (view === "tester") {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium">Test Protocol</h3>
            <p className="text-muted-foreground text-sm">
              Connect to a device and test your protocol before saving
            </p>
          </div>
          <Button type="button" onClick={() => setView("form")} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Form
          </Button>
        </div>
        <IotProtocolTester
          protocolCode={form.watch("code")}
          sensorFamily={form.watch("family")}
          protocolName={form.watch("name") || "Untitled Protocol"}
        />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium">{t("protocols.newProtocol")}</h3>
            <p className="text-muted-foreground text-sm">{t("newProtocol.description")}</p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    type="button"
                    onClick={() => setView("tester")}
                    variant="outline"
                    disabled={!browserSupport.bluetooth && !browserSupport.serial}
                  >
                    <FlaskConical className="mr-2 h-4 w-4" />
                    Test Protocol
                  </Button>
                </div>
              </TooltipTrigger>
              {!browserSupport.bluetooth && !browserSupport.serial && (
                <TooltipContent side="left" className="max-w-xs">
                  <p>Your browser doesn&apos;t support Web Bluetooth or Web Serial APIs.</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Try using Chrome, Edge, or Opera on desktop.
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

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
          <Button type="button" onClick={cancel} variant="outline">
            {t("newProtocol.cancel")}
          </Button>
          <Button type="submit" disabled={isDisabled}>
            {isPending ? t("newProtocol.creating") : t("newProtocol.finalizeSetup")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
