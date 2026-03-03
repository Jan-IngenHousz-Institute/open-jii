import { router } from "expo-router";
import React from "react";
import { View } from "react-native";
import { Button } from "~/components/Button";

export function NoDeviceState() {
  return (
    <View className="flex-1 items-center justify-center">
      <Button
        title="Please connect to a device first"
        onPress={() => router.push("/(tabs)/")}
        style={{ height: 44 }}
      ></Button>
    </View>
  );
}
