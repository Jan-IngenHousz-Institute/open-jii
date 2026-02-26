import { Stack } from "expo-router";

export default function MeasurementFlowLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="flow" />
    </Stack>
  );
}
