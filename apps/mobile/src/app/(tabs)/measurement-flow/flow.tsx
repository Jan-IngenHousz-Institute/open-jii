import { useRouter } from "expo-router";
import { MeasurementFlowScreen } from "~/screens/measurement-flow-screen/measurement-flow-screen";

export default function MeasureFlowScreen() {
  const router = useRouter();
  return <MeasurementFlowScreen onEndFlowComplete={() => router.back()} />;
}
