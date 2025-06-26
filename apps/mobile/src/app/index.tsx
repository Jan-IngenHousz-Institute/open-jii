import { Redirect } from "expo-router";
import { useSessionStore } from "~/hooks/use-session-store";

export default function Index() {
  const { session, isLoaded } = useSessionStore();
  if (!isLoaded) {
    return null;
  }

  if (session?.token || process.env.DISABLE_AUTH === "true") {
    return <Redirect href="(tabs)" />;
  }

  return <Redirect href="/callback" />;
}
