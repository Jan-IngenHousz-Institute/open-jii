import { render } from "@react-email/components";

import { ProjectTransferComplete } from "../emails/project-transfer-complete";

export interface RenderProjectTransferCompleteParams {
  host: string;
  experimentName: string;
  experimentUrl: string;
  baseUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderProjectTransferComplete(
  params: RenderProjectTransferCompleteParams,
): Promise<RenderedEmail> {
  const { host, experimentName, experimentUrl, baseUrl } = params;

  const html = await render(
    ProjectTransferComplete({ host, experimentName, experimentUrl, baseUrl }),
    {},
  );
  const text = await render(
    ProjectTransferComplete({ host, experimentName, experimentUrl, baseUrl }),
    {
      plainText: true,
    },
  );

  return { html, text };
}
