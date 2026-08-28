"use client";

import { useLocale } from "@/hooks/useLocale";
import { ArrowRight, Download, ExternalLink, FileText, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { IssueIotCredentialsResponse } from "@repo/api/domains/iot/iot.schema";
import { useTranslation } from "@repo/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";

import { AMAZON_ROOT_CA_1_PEM, AMAZON_ROOT_CA_3_PEM, ROOT_CA_FILES } from "./amazon-root-ca";
import { CredentialsShowOnceBanner } from "./credentials-show-once-banner";
import {
  IotCredentialFile,
  credentialBundleZipName,
  deviceCredentialFiles,
  downloadZip,
} from "./iot-credential-file";

const AMAZON_CA_DOCS =
  "https://docs.aws.amazon.com/iot/latest/developerguide/server-authentication.html";

const CARD = "divide-border border-border divide-y rounded-lg border px-3";

interface IotCredentialsDialogProps {
  deviceId: string;
  thingName: string;
  credentials: IssueIotCredentialsResponse | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * The show-once bundle, reweighted so the private key cannot slip away
 * unnoticed: the warning covers the whole bundle from the top, downloading
 * everything is the primary action, and closing without having downloaded
 * anything asks first. Once the bundle is saved, the primary hands off to
 * onboarding, the step that actually comes next.
 */
export function IotCredentialsDialog({
  deviceId,
  thingName,
  credentials,
  onOpenChange,
}: IotCredentialsDialogProps) {
  const { t } = useTranslation("iot");
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();

  // Keyed by certificate so a later issuance starts untouched; no reset effect.
  const [bundleDownloadedFor, setBundleDownloadedFor] = useState<string | null>(null);
  const [anythingDownloadedFor, setAnythingDownloadedFor] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const certificateId = credentials?.certificateId ?? null;
  const hasBundle = certificateId !== null && bundleDownloadedFor === certificateId;
  const hasAnything =
    certificateId !== null &&
    (anythingDownloadedFor === certificateId || bundleDownloadedFor === certificateId);

  const files =
    credentials !== null
      ? [...deviceCredentialFiles(thingName, credentials), ...ROOT_CA_FILES]
      : [];

  const markFileDownloaded = () => setAnythingDownloadedFor(certificateId);

  const downloadAll = () => {
    downloadZip(credentialBundleZipName(thingName), files);
    setBundleDownloadedFor(certificateId);
  };

  const requestClose = (open: boolean) => {
    if (open) {
      return;
    }
    if (!hasAnything) {
      setConfirmingClose(true);
      return;
    }
    onOpenChange(false);
  };

  const closeAnyway = () => {
    setConfirmingClose(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={credentials !== null} onOpenChange={requestClose}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("iot.devices.credentials.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("iot.devices.credentials.dialogDescription")}</DialogDescription>
          </DialogHeader>

          {credentials !== null && (
            <div className="min-w-0 space-y-6">
              {/* Above everything: the whole bundle is show-once, not just the keys. */}
              <CredentialsShowOnceBanner />

              <section className="space-y-1.5">
                <h3 className="text-foreground text-sm font-semibold">
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
                    onDownload={markFileDownloaded}
                  />
                </div>
              </section>

              <section className="space-y-2">
                <div className="space-y-1">
                  <h3 className="text-foreground text-sm font-semibold">
                    {t("iot.devices.credentials.sectionKeys")}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {t("iot.devices.credentials.keysDescription")}
                  </p>
                </div>

                <div className={CARD}>
                  <IotCredentialFile
                    icon={KeyRound}
                    label={t("iot.devices.credentials.publicKey")}
                    sublabel={`${thingName}.public.key`}
                    filename={`${thingName}.public.key`}
                    content={credentials.publicKey}
                    copyable
                    onDownload={markFileDownloaded}
                  />
                  <IotCredentialFile
                    icon={KeyRound}
                    label={t("iot.devices.credentials.privateKey")}
                    sublabel={`${thingName}.private.key`}
                    filename={`${thingName}.private.key`}
                    content={credentials.privateKey}
                    copyable
                    onDownload={markFileDownloaded}
                  />
                </div>
              </section>

              <section className="space-y-2">
                <div className="space-y-1">
                  <h3 className="text-foreground text-sm font-semibold">
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
                    onDownload={markFileDownloaded}
                  />
                  <IotCredentialFile
                    icon={ShieldCheck}
                    label={t("iot.devices.credentials.rootCa3")}
                    sublabel={t("iot.devices.credentials.rootCa3Sub")}
                    filename="AmazonRootCA3.pem"
                    content={AMAZON_ROOT_CA_3_PEM}
                    onDownload={markFileDownloaded}
                  />
                </div>
              </section>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => requestClose(false)}>
              {tCommon("common.close")}
            </Button>
            {hasBundle ? (
              <Button type="button" asChild>
                <Link href={`/${locale}/platform/devices/${deviceId}/onboarding`}>
                  {t("iot.devices.credentials.continueToOnboarding")}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button type="button" onClick={downloadAll}>
                <Download className="mr-1.5 h-4 w-4" />
                {t("iot.devices.credentials.downloadAll")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmingClose} onOpenChange={setConfirmingClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("iot.devices.credentials.closeUnsavedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("iot.devices.credentials.closeUnsavedDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("iot.devices.credentials.closeUnsavedBack")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={closeAnyway}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("iot.devices.credentials.closeUnsavedConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
