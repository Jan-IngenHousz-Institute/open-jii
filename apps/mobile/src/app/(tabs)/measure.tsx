import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useEffect } from "react";

// "Measure" is a launcher-only tab: its tabPress is intercepted in the tab
// layout to push the root `/measurement-flow` screen, so this scene normally
// never renders. If something routes here directly (e.g. a deep link), redirect
// into the flow on focus so the user never lands on this blank scene.
export default function MeasureLauncher() {
  const router = useRouter();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) router.replace("/measurement-flow");
  }, [isFocused, router]);

  return null;
}
