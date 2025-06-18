import { Redirect } from "expo-router";
import { useSessionStore } from "~/hooks/use-session-store";

export default function Index() {
  const { session, isLoaded } = useSessionStore();
  if (!isLoaded) {
    return null;
  }

  if (session?.token) {
    return <Redirect href="(tabs)" />;
  }

  return <Redirect href="(auth)/login" />;
}
