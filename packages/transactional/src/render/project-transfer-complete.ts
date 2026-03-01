import { render } from "@react-email/components";

import { ProjectTransferComplete } from "../emails/project-transfer-complete";

export interface RenderProjectTransferCompleteParams {
  host: string;
  experimentName: string;
  experimentUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderProjectTransferComplete(
  params: RenderProjectTransferCompleteParams,
): Promise<RenderedEmail> {
  const { host, experimentName, experimentUrl } = params;

  const html = await render(ProjectTransferComplete({ host, experimentName, experimentUrl }), {});
  const text = await render(ProjectTransferComplete({ host, experimentName, experimentUrl }), {
    plainText: true,
  });

  return { html, text };
}
