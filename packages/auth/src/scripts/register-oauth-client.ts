import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { db } from "@repo/database";

import { oauthClientManagement } from "../oidc/client-management";
import { auth } from "../server";

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      "redirect-uri": { type: "string", multiple: true },
      "session-header": { type: "string", default: "../../.claude/session.header" },
    },
  });
  if (!values.name || !values["redirect-uri"]?.length) {
    throw new Error(
      "Usage: oauth:register --name <name> --redirect-uri <uri> [--redirect-uri <uri>]",
    );
  }
  const redirectUris = values["redirect-uri"];
  const sessionHeader = await readFile(resolve(values["session-header"]), "utf8");
  const cookie = /^cookie:\s*(.+)$/im.exec(sessionHeader.trim())?.[1];
  if (!cookie)
    throw new Error("Session header must contain a Cookie header. Run pnpm local:login first.");
  const client = await oauthClientManagement.run(true, () =>
    auth.api.adminCreateOAuthClient({
      headers: new Headers({ cookie }),
      body: {
        client_name: values.name,
        redirect_uris: redirectUris,
        skip_consent: true,
        require_pkce: true,
        scope: "openid profile email offline_access",
        grant_types: ["authorization_code", "refresh_token"],
        token_endpoint_auth_method: "client_secret_basic",
        type: "web",
      },
    }),
  );
  console.log(JSON.stringify({ client_id: client.client_id, client_secret: client.client_secret }));
}

void main()
  .catch(() => {
    console.error("Client registration failed. Check the arguments, database and session header.");
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
