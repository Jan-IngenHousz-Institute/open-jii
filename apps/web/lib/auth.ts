/* eslint-disable no-restricted-properties */
import { initAuth } from "@repo/auth/next";
import type { NextAuth, NextAuthResult } from "@repo/auth/next";
import "@repo/auth/types";

import type { SecretMap } from "./secrets";
import { getSecret, isLambdaEnvironment } from "./secrets";

const nextAuth = (async () => {
  const isLambda = isLambdaEnvironment();
  let authSecrets: SecretMap = {};
  let dbSecrets: SecretMap = {};
  let sesSecrets: SecretMap = {};

  if (isLambda) {
    authSecrets = await getSecret(process.env.OAUTH_SECRET_ARN ?? "");
    dbSecrets = await getSecret(process.env.DB_SECRET_ARN ?? "");
    sesSecrets = await getSecret(process.env.SES_SECRET_ARN ?? "");
  }

  return initAuth({ authSecrets, dbSecrets, sesSecrets, isLambda });
})();

const {
  handlers,
  auth: _auth,
  signIn: _signIn,
  signOut: _signOut,
  providerMap,
  unstable_update: unstableUpdate,
}: NextAuth = await nextAuth;

const auth: NextAuthResult["auth"] = _auth;
const signIn: NextAuthResult["signIn"] = _signIn;
const signOut: NextAuthResult["signOut"] = _signOut;

export { handlers, auth, signIn, signOut, providerMap, unstableUpdate };
