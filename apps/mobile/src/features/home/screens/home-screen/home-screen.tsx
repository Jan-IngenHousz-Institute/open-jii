import React from "react";
import { ScrollView, View } from "react-native";
import { HomeContinueCard } from "~/features/home/components/home-continue-card";
import { HomeDeviceCard } from "~/features/home/components/home-device-card";
import { HomeGreeting } from "~/features/home/components/home-greeting";
import { HomePrimaryCta } from "~/features/home/components/home-primary-cta";
import { HomeRecentMeasurements } from "~/features/home/components/home-recent-measurements";

export function HomeScreen() {
  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
      showsVerticalScrollIndicator={false}
    >
      <HomeGreeting />
      <HomeContinueCard />
      <HomePrimaryCta />
      <HomeDeviceCard />
      <HomeRecentMeasurements />
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

export default HomeScreen;
