import { Redirect } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useSession } from "~/hooks/use-session";

export default function Index() {
  const { session, isLoaded } = useSession();

  useEffect(() => {
    if (isLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [isLoaded]);

  if (!isLoaded) {
    return null;
  }

  if (session) {
    return <Redirect href="(tabs)" />;
  }

  return <Redirect href="/callback" />;
}
