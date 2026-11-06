import { render } from "@react-email/components";

import type { EmailUnsubscribe } from "../components/email-layout";
import { Email } from "../emails/email";
import { CalibrationRunAwaitingApprovalNotification } from "../emails/fallbacks/calibration-run-awaiting-approval-notification";
import { getCmsEmail } from "../lib/contentful";

export interface RenderCalibrationRunAwaitingApprovalNotificationParams {
  host: string;
  baseUrl: string;
  deviceName: string;
  definitionName: string;
  actor: string;
  calibrationUrl: string;
  unsubscribe?: EmailUnsubscribe;
}

export interface RenderedEmail {
  html: string;
  text: string;
  preview: string;
}

export async function renderCalibrationRunAwaitingApprovalNotification(
  params: RenderCalibrationRunAwaitingApprovalNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, deviceName, definitionName, actor, calibrationUrl, unsubscribe } = params;

  const emailData = await getCmsEmail("calibration-run-awaiting-approval-notification", {
    host,
    baseUrl,
    deviceName,
    definitionName,
    actor,
    calibrationUrl,
  });

  if (!emailData) {
    const html = await render(
      CalibrationRunAwaitingApprovalNotification({
        host,
        baseUrl,
        deviceName,
        definitionName,
        actor,
        calibrationUrl,
        unsubscribe,
      }),
      {},
    );
    const text = await render(
      CalibrationRunAwaitingApprovalNotification({
        host,
        baseUrl,
        deviceName,
        definitionName,
        actor,
        calibrationUrl,
        unsubscribe,
      }),
      { plainText: true },
    );
    return {
      html,
      text,
      preview: `A ${definitionName} calibration of ${deviceName} is waiting for approval`,
    };
  }

  const html = await render(
    Email({
      host,
      baseUrl,
      cmsPreview: emailData.preview,
      cmsContent: emailData.content,
      unsubscribe,
    }),
    {},
  );

  const text = await render(
    Email({
      host,
      baseUrl,
      cmsPreview: emailData.preview,
      cmsContent: emailData.content,
      unsubscribe,
    }),
    { plainText: true },
  );

  return { html, text, preview: emailData.preview };
}
