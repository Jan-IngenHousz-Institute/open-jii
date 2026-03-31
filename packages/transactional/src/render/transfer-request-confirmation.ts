import { render } from "@react-email/components";

import { TransferRequestConfirmation } from "../emails/transfer-request-confirmation";

export interface RenderTransferRequestConfirmationParams {
  host: string;
  projectIdOld: string;
  projectUrlOld: string;
  userEmail: string;
  baseUrl: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderTransferRequestConfirmation(
  params: RenderTransferRequestConfirmationParams,
): Promise<RenderedEmail> {
  const { host, projectIdOld, projectUrlOld, userEmail, baseUrl } = params;

  const html = await render(
    TransferRequestConfirmation({ host, projectIdOld, projectUrlOld, userEmail, baseUrl }),
    {},
  );
  const text = await render(
    TransferRequestConfirmation({ host, projectIdOld, projectUrlOld, userEmail, baseUrl }),
    {
      plainText: true,
    },
  );

  return { html, text };
}
