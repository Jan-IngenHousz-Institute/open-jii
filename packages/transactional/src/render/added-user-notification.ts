import { render } from "@react-email/components";

import { AddedUserNotification } from "../emails/added-user-notification";

export interface RenderAddedUserNotificationParams {
  host: string;
  experimentName: string;
  experimentUrl: string;
  actor: string;
  role: string;
  baseUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderAddedUserNotification(
  params: RenderAddedUserNotificationParams,
): Promise<RenderedEmail> {
  const { host, baseUrl, experimentName, experimentUrl, actor, role } = params;

  const html = await render(
    AddedUserNotification({
      host,
      experimentName,
      experimentUrl,
      actor,
      role,
      baseUrl,
    }),
    {},
  );
  const text = await render(
    AddedUserNotification({
      host,
      experimentName,
      experimentUrl,
      actor,
      role,
      baseUrl,
    }),
    {
      plainText: true,
    },
  );

  return { html, text };
}
