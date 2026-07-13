"use client";

import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileText,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

import type { IssueIotCredentialsResponse } from "@repo/api/schemas/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";

import { AMAZON_ROOT_CA_1_PEM, AMAZON_ROOT_CA_3_PEM } from "./amazon-root-ca";
import { IotCredentialFile, downloadZip } from "./iot-credential-file";

const AMAZON_CA_DOCS =
  "https://docs.aws.amazon.com/iot/latest/developerguide/server-authentication.html";

const CARD = "divide-y divide-[#EDF2F6] rounded-lg border border-[#CDD5DB] px-3";

interface IotCredentialsDialogProps {
  thingName: string;
  credentials: IssueIotCredentialsResponse | null;
  onOpenChange: (open: boolean) => void;
}

export function IotCredentialsDialog({
  thingName,
  credentials,
  onOpenChange,
}: IotCredentialsDialogProps) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");

  const files =
    credentials !== null
      ? [
          { filename: `${thingName}.cert.pem`, content: credentials.certificatePem },
          { filename: `${thingName}.public.key`, content: credentials.publicKey },
          { filename: `${thingName}.private.key`, content: credentials.privateKey },
          { filename: "AmazonRootCA1.pem", content: AMAZON_ROOT_CA_1_PEM },
          { filename: "AmazonRootCA3.pem", content: AMAZON_ROOT_CA_3_PEM },
        ]
      : [];

  const downloadAll = () => downloadZip(`${thingName}-credentials.zip`, files);

  return (
    <Dialog open={credentials !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("iot.devices.credentials.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("iot.devices.credentials.dialogDescription")}</DialogDescription>
        </DialogHeader>

        {credentials !== null && (
          <div className="min-w-0 space-y-6">
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold text-[#011111]">
                {t("iot.devices.credentials.sectionCertificate")}
              </h3>
              <div className={CARD}>
                <IotCredentialFile
                  icon={FileText}
                  label={t("iot.devices.credentials.certificate")}
                  sublabel={`${thingName}.cert.pem`}
                  filename={`${thingName}.cert.pem`}
                  content={credentials.certificatePem}
                  copyable
                />
              </div>
            </section>

            <section className="space-y-2">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[#011111]">
                  {t("iot.devices.credentials.sectionKeys")}
                </h3>
                <p className="text-muted-foreground text-xs">
                  {t("iot.devices.credentials.keysDescription")}
                </p>
              </div>

              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>{t("iot.devices.credentials.showOnceWarning")}</span>
              </div>

              <div className={CARD}>
                <IotCredentialFile
                  icon={KeyRound}
                  label={t("iot.devices.credentials.publicKey")}
                  sublabel={`${thingName}.public.key`}
                  filename={`${thingName}.public.key`}
                  content={credentials.publicKey}
                  copyable
                />
                <IotCredentialFile
                  icon={KeyRound}
                  label={t("iot.devices.credentials.privateKey")}
                  sublabel={`${thingName}.private.key`}
                  filename={`${thingName}.private.key`}
                  content={credentials.privateKey}
                  copyable
                />
              </div>
            </section>

            <section className="space-y-2">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[#011111]">
                  {t("iot.devices.credentials.sectionRootCa")}
                </h3>
                <p className="text-muted-foreground text-xs">
                  {t("iot.devices.credentials.rootCaDescription")}{" "}
                  <a
                    href={AMAZON_CA_DOCS}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground inline-flex items-center gap-0.5 underline"
                  >
                    {t("iot.devices.credentials.rootCaLearnMore")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
              <div className={CARD}>
                <IotCredentialFile
                  icon={ShieldCheck}
                  label={t("iot.devices.credentials.rootCa1")}
                  sublabel={t("iot.devices.credentials.rootCa1Sub")}
                  filename="AmazonRootCA1.pem"
                  content={AMAZON_ROOT_CA_1_PEM}
                />
                <IotCredentialFile
                  icon={ShieldCheck}
                  label={t("iot.devices.credentials.rootCa3")}
                  sublabel={t("iot.devices.credentials.rootCa3Sub")}
                  filename="AmazonRootCA3.pem"
                  content={AMAZON_ROOT_CA_3_PEM}
                />
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={downloadAll}>
            <Download className="mr-1.5 h-4 w-4" />
            {t("iot.devices.credentials.downloadAll")}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {tCommon("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
