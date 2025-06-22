import { initAuth } from "@repo/auth/next";
import type { NextAuth, NextAuthResult } from "@repo/auth/next";

import type { SecretMap } from "./secrets";
import { getSecret, isLambdaEnvironment } from "./secrets";

const nextAuth = (async () => {
  const isLambda = isLambdaEnvironment();
  let authSecrets: SecretMap = {};
  let dbSecrets: SecretMap = {};

  if (isLambda) {
    authSecrets = await getSecret("AUTH_SECRET_ARN");
    dbSecrets = await getSecret("DB_SECRET_ARN");
  }

  return initAuth({ authSecrets, dbSecrets, isLambda });
})();

const {
  handlers,
  auth: _auth,
  signIn: _signIn,
  signOut: _signOut,
  providerMap,
}: NextAuth = await nextAuth;

const auth: NextAuthResult["auth"] = _auth;
const signIn: NextAuthResult["signIn"] = _signIn;
const signOut: NextAuthResult["signOut"] = _signOut;

export { handlers, auth, signIn, signOut, providerMap };
