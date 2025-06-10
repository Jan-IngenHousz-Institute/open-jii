import { ArrowLeft } from "lucide-react-native";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Button } from "~/components/Button";
import { Dropdown } from "~/components/Dropdown";
import { MeasurementResult } from "~/components/MeasurementResult";
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/useTheme";

const { height } = Dimensions.get("window");

interface Protocol {
  label: string;
  value: string;
  description?: string;
}

interface MeasurementScreenProps {
  experimentName: string;
  protocols: Protocol[];
  selectedProtocol: string | undefined;
  onSelectProtocol: (value: string) => void;
  onStartMeasurement: () => void;
  onUploadMeasurement: () => void;
  onDisconnect: () => void;
  isMeasuring: boolean;
  isUploading: boolean;
  isConnected: boolean;
  measurementData: any;
}

export function MeasurementScreen({
  experimentName,
  protocols,
  selectedProtocol,
  onSelectProtocol,
  onStartMeasurement,
  onUploadMeasurement,
  onDisconnect,
  isMeasuring,
  isUploading,
  isConnected,
  measurementData,
}: MeasurementScreenProps) {
  const theme = useTheme();

  return (
    <View style={styles.measurementStepContainer}>
      {/* Compact header with experiment name and back button */}
      <View style={styles.compactHeader}>
        <TouchableOpacity style={styles.backButton} onPress={onDisconnect}>
          <ArrowLeft size={18} color={colors.primary.dark} />
          <Text style={[styles.backButtonText, { color: colors.primary.dark }]}>
            Back
          </Text>
        </TouchableOpacity>

        <View
          style={[
            styles.experimentBadge,
            {
              backgroundColor: colors.primary.dark + "20",
              borderColor: colors.primary.dark,
            },
          ]}
        >
          <Text
            style={[styles.experimentBadgeText, { color: colors.primary.dark }]}
          >
            {experimentName}
          </Text>
        </View>
      </View>

      {/* Protocol selection and start measurement button */}
      <View style={styles.protocolContainer}>
        <Dropdown
          label="Protocol"
          options={protocols}
          selectedValue={selectedProtocol}
          onSelect={onSelectProtocol}
          placeholder="Select protocol"
        />

        <Button
          title="Start Measurement"
          onPress={onStartMeasurement}
          isLoading={isMeasuring}
          isDisabled={!isConnected || !selectedProtocol}
          style={styles.startButton}
        />
      </View>

      {/* Measurement result - takes most of the screen */}
      <View style={styles.resultContainer}>
        {measurementData ? (
          <View style={styles.resultContent}>
            <Text
              style={[
                styles.resultTitle,
                {
                  color: theme.isDark
                    ? colors.dark.onSurface
                    : colors.light.onSurface,
                },
              ]}
            >
              Measurement Result
            </Text>
            <View style={styles.resultDataContainer}>
              <MeasurementResult
                data={measurementData}
                timestamp={measurementData.timestamp}
                experimentName={measurementData.experiment}
              />
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.noResultContainer,
              {
                backgroundColor: theme.isDark
                  ? colors.dark.card
                  : colors.light.card,
              },
            ]}
          >
            <Text
              style={[
                styles.noResultText,
                {
                  color: theme.isDark
                    ? colors.dark.inactive
                    : colors.light.inactive,
                },
              ]}
            >
              No measurement data yet. Start a measurement to see results here.
            </Text>
          </View>
        )}
      </View>

      {/* Upload button at the bottom */}
      <View style={styles.uploadContainer}>
        <Button
          title="Upload Measurement"
          onPress={onUploadMeasurement}
          isLoading={isUploading}
          isDisabled={!measurementData}
          style={styles.uploadButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  measurementStepContainer: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  compactHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButtonText: {
    marginLeft: 4,
    fontSize: 14,
  },
  experimentBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  experimentBadgeText: {
    fontWeight: "bold",
    fontSize: 14,
  },
  protocolContainer: {
    marginBottom: 16,
  },
  startButton: {
    marginTop: 8,
  },
  resultContainer: {
    flex: 1,
    justifyContent: "center",
    marginVertical: 16,
    maxHeight: height * 0.5, // Take up to 50% of screen height
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  resultDataContainer: {
    flex: 1,
    maxHeight: height * 0.5, // Take up to 50% of screen height
  },
  noResultContainer: {
    flex: 1,
    borderRadius: 8,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  noResultText: {
    textAlign: "center",
    fontSize: 16,
  },
  uploadContainer: {
    marginTop: 16,
  },
  uploadButton: {
    width: "100%",
  },
});
