import { render } from "@react-email/components";

import { AddedUserNotification } from "../emails/added-user-notification";

export interface RenderAddedUserNotificationParams {
  host: string;
  experimentName: string;
  experimentUrl: string;
  actor: string;
  role: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderAddedUserNotification(
  params: RenderAddedUserNotificationParams,
): Promise<RenderedEmail> {
  const { host, experimentName, experimentUrl, actor, role } = params;

  const html = await render(
    AddedUserNotification({ host, experimentName, experimentUrl, actor, role }),
    {},
  );
  const text = await render(
    AddedUserNotification({ host, experimentName, experimentUrl, actor, role }),
    {
      plainText: true,
    },
  );

  return { html, text };
}
