import React from "react";
import { View, ScrollView } from "react-native";
import { ConnectionSetup } from "~/features/connection/components/connection-setup";

export default function HomeScreen() {
  return (
    <View className="bg-background flex-1">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <View className="mb-6">
          <ConnectionSetup />
        </View>
      </ScrollView>
    </View>
  );
}
