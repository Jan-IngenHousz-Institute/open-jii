import { Bluetooth, Usb, Radio, AlertTriangle } from "lucide-react-native";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from "react-native";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
import { Dropdown } from "~/components/Dropdown";
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/useTheme";

interface ConnectionSetupProps {
  selectedExperiment: string | null;
  selectedConnectionType: "bluetooth" | "ble" | "usb" | null;
  mockExperiments: {
    label: string;
    value: string;
    description?: string;
  }[];
  onSelectExperiment: (value: string) => void;
  onSelectConnectionType: (type: "bluetooth" | "ble" | "usb") => void;
  onScanForDevices: () => void;
  isScanning: boolean;
}

export function ConnectionSetup({
  selectedExperiment,
  selectedConnectionType,
  mockExperiments,
  onSelectExperiment,
  onSelectConnectionType,
  onScanForDevices,
  isScanning,
}: ConnectionSetupProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {/* Experiment Selection */}
      <View style={styles.experimentSection}>
        <Text
          style={[
            styles.sectionTitle,
            {
              color: theme.isDark
                ? colors.dark.onSurface
                : colors.light.onSurface,
            },
          ]}
        >
          Select Experiment
        </Text>
        <Dropdown
          options={mockExperiments}
          selectedValue={selectedExperiment ?? undefined}
          onSelect={onSelectExperiment}
          placeholder="Choose an experiment"
        />
      </View>

      {/* Warning if no experiment selected */}
      {!selectedExperiment && (
        <Card style={styles.warningCard}>
          <View style={styles.warningContent}>
            <AlertTriangle size={20} color={colors.semantic.warning} />
            <Text
              style={[
                styles.warningText,
                {
                  color: theme.isDark
                    ? colors.dark.onSurface
                    : colors.light.onSurface,
                },
              ]}
            >
              Please select an experiment before connecting to a device
            </Text>
          </View>
        </Card>
      )}

      {/* Connection Type Selection */}
      {selectedExperiment && (
        <>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.isDark
                  ? colors.dark.onSurface
                  : colors.light.onSurface,
              },
            ]}
          >
            Connection Type
          </Text>
          <View style={styles.connectionTypeContainer}>
            {/* Bluetooth Classic */}
            <TouchableOpacity
              style={[
                styles.connectionTypeButton,
                {
                  backgroundColor: theme.isDark
                    ? colors.dark.card
                    : colors.light.card,
                },
                selectedConnectionType === "bluetooth" && [
                  styles.selectedConnectionType,
                  {
                    borderColor: colors.primary.dark,
                    backgroundColor: colors.primary.dark + "10",
                  },
                ],
              ]}
              onPress={() => onSelectConnectionType("bluetooth")}
              disabled={Platform.OS === "ios"}
            >
              <Bluetooth
                size={24}
                color={
                  selectedConnectionType === "bluetooth"
                    ? colors.primary.dark
                    : Platform.OS === "ios"
                      ? theme.isDark
                        ? colors.dark.inactive
                        : colors.light.inactive
                      : theme.isDark
                        ? colors.dark.onSurface
                        : colors.light.onSurface
                }
              />
              <Text
                style={[
                  styles.connectionTypeText,
                  {
                    color: theme.isDark
                      ? colors.dark.onSurface
                      : colors.light.onSurface,
                  },
                  selectedConnectionType === "bluetooth" && [
                    styles.selectedConnectionTypeText,
                    { color: colors.primary.dark },
                  ],
                  Platform.OS === "ios" && [
                    styles.disabledText,
                    {
                      color: theme.isDark
                        ? colors.dark.inactive
                        : colors.light.inactive,
                    },
                  ],
                ]}
              >
                Bluetooth Classic
              </Text>
              {Platform.OS === "ios" && (
                <Text
                  style={[
                    styles.platformNote,
                    {
                      color: theme.isDark
                        ? colors.dark.inactive
                        : colors.light.inactive,
                    },
                  ]}
                >
                  Android only
                </Text>
              )}
            </TouchableOpacity>

            {/* Bluetooth LE */}
            <TouchableOpacity
              style={[
                styles.connectionTypeButton,
                {
                  backgroundColor: theme.isDark
                    ? colors.dark.card
                    : colors.light.card,
                },
                selectedConnectionType === "ble" && [
                  styles.selectedConnectionType,
                  {
                    borderColor: colors.primary.dark,
                    backgroundColor: colors.primary.dark + "10",
                  },
                ],
              ]}
              onPress={() => onSelectConnectionType("ble")}
            >
              <Radio
                size={24}
                color={
                  selectedConnectionType === "ble"
                    ? colors.primary.dark
                    : theme.isDark
                      ? colors.dark.onSurface
                      : colors.light.onSurface
                }
              />
              <Text
                style={[
                  styles.connectionTypeText,
                  {
                    color: theme.isDark
                      ? colors.dark.onSurface
                      : colors.light.onSurface,
                  },
                  selectedConnectionType === "ble" && [
                    styles.selectedConnectionTypeText,
                    { color: colors.primary.dark },
                  ],
                ]}
              >
                Bluetooth LE
              </Text>
            </TouchableOpacity>

            {/* USB */}
            <TouchableOpacity
              style={[
                styles.connectionTypeButton,
                {
                  backgroundColor: theme.isDark
                    ? colors.dark.card
                    : colors.light.card,
                },
                selectedConnectionType === "usb" && [
                  styles.selectedConnectionType,
                  {
                    borderColor: colors.primary.dark,
                    backgroundColor: colors.primary.dark + "10",
                  },
                ],
              ]}
              onPress={() => onSelectConnectionType("usb")}
              disabled={Platform.OS === "ios"}
            >
              <Usb
                size={24}
                color={
                  selectedConnectionType === "usb"
                    ? colors.primary.dark
                    : Platform.OS === "ios"
                      ? theme.isDark
                        ? colors.dark.inactive
                        : colors.light.inactive
                      : theme.isDark
                        ? colors.dark.onSurface
                        : colors.light.onSurface
                }
              />
              <Text
                style={[
                  styles.connectionTypeText,
                  {
                    color: theme.isDark
                      ? colors.dark.onSurface
                      : colors.light.onSurface,
                  },
                  selectedConnectionType === "usb" && [
                    styles.selectedConnectionTypeText,
                    { color: colors.primary.dark },
                  ],
                  Platform.OS === "ios" && [
                    styles.disabledText,
                    {
                      color: theme.isDark
                        ? colors.dark.inactive
                        : colors.light.inactive,
                    },
                  ],
                ]}
              >
                USB Serial
              </Text>
              {Platform.OS === "ios" && (
                <Text
                  style={[
                    styles.platformNote,
                    {
                      color: theme.isDark
                        ? colors.dark.inactive
                        : colors.light.inactive,
                    },
                  ]}
                >
                  Android only
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.actionsContainer}>
            <Button
              title="Scan for Devices"
              onPress={onScanForDevices}
              isLoading={isScanning}
              isDisabled={!selectedConnectionType}
              style={styles.actionButton}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  experimentSection: {
    marginBottom: 24,
  },
  warningCard: {
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: colors.semantic.warning,
  },
  warningContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  warningText: {
    marginLeft: 8,
    flex: 1,
  },
  connectionTypeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  connectionTypeButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  selectedConnectionType: {
    borderWidth: 1,
  },
  connectionTypeText: {
    marginTop: 8,
    fontSize: 12,
    textAlign: "center",
  },
  selectedConnectionTypeText: {
    fontWeight: "bold",
  },
  disabledText: {},
  platformNote: {
    fontSize: 10,
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
});
