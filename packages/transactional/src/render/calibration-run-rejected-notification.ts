import { render } from "@react-email/components";

import type { EmailUnsubscribe } from "../components/email-layout";
import { Email } from "../emails/email";
import { CalibrationRunRejectedNotification } from "../emails/fallbacks/calibration-run-rejected-notification";
import { getCmsEmail } from "../lib/contentful";

export interface RenderCalibrationRunRejectedNotificationParams {
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

export async function renderCalibrationRunRejectedNotification(
  params: RenderCalibrationRunRejectedNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, deviceName, definitionName, actor, calibrationUrl, unsubscribe } = params;

  const emailData = await getCmsEmail("calibration-run-rejected-notification", {
    host,
    baseUrl,
    deviceName,
    definitionName,
    actor,
    calibrationUrl,
  });

  if (!emailData) {
    const html = await render(
      CalibrationRunRejectedNotification({
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
      CalibrationRunRejectedNotification({
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
      preview: `Your ${definitionName} calibration of ${deviceName} was rejected`,
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
