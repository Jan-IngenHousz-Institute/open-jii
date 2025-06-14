import { useAsyncCallback } from "react-async-hook";
import { getSessionData } from "~/api/get-session-data";
import { login } from "~/auth/login";

export function useLoginFlow() {
  const {
    execute: startLoginFlow,
    result: user,
    loading,
  } = useAsyncCallback(async () => {
    const token = await login();

    if (!token) {
      return undefined;
    }

    const data = await getSessionData(token);

    return { data, token };
  });

  return { startLoginFlow, user, loading };
}
