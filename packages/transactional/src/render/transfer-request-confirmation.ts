import { render } from "@react-email/components";

import { TransferRequestConfirmation } from "../emails/transfer-request-confirmation";

export interface RenderTransferRequestConfirmationParams {
  host: string;
  projectIdOld: string;
  projectUrlOld: string;
  userEmail: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderTransferRequestConfirmation(
  params: RenderTransferRequestConfirmationParams,
): Promise<RenderedEmail> {
  const { host, projectIdOld, projectUrlOld, userEmail } = params;

  const html = await render(
    TransferRequestConfirmation({ host, projectIdOld, projectUrlOld, userEmail }),
    {},
  );
  const text = await render(
    TransferRequestConfirmation({ host, projectIdOld, projectUrlOld, userEmail }),
    {
      plainText: true,
    },
  );

  return { html, text };
}
