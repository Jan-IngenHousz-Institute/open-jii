import { Redirect } from "expo-router";
import { useSession } from "~/hooks/use-session";

export default function Index() {
  const { session, isLoaded } = useSession();
  if (!isLoaded) {
    return null;
  }

  if (session) {
    return <Redirect href="(tabs)" />;
  }

  return <Redirect href="/callback" />;
}
