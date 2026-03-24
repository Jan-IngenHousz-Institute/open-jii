import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export function OfflineBanner() {
  return (
    <View style={styles.container}>
      <MaterialIcons name="wifi-off" size={18} color="#92400e" />
      <Text style={styles.text}>You are offline. Please connect to the internet to log in.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: "#92400e",
  },
});
