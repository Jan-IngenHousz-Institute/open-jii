import { cva } from "class-variance-authority";
import { CameraView } from "expo-camera";
import { Info, X } from "lucide-react-native";
import React, { useRef } from "react";
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { createLogger } from "~/shared/observability/logger";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { CameraPermissionState, useCameraPermission } from "./camera-permission-state";

const log = createLogger("qr-scanner");

const closeButtonVariants = cva("absolute right-5 top-14 z-10 rounded-full p-2", {
  variants: {
    cameraActive: {
      true: "border border-white/20 bg-white/10",
      false: "bg-black/50",
    },
  },
  defaultVariants: {
    cameraActive: false,
  },
});

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
  showMatchNote?: boolean;
}

export function QRScannerModal({
  visible,
  onClose,
  onScanned,
  showMatchNote,
}: QRScannerModalProps) {
  const [permission, requestPermission] = useCameraPermission();
  const { colors } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const { height } = Dimensions.get("window");

  // scanned is a guard for double-fires during a single visibility cycle, not
  // a value that drives render. Reset synchronously when visible transitions
  // false → true (React's recommended "reset state on prop change" pattern).
  const scannedRef = useRef(false);
  const prevVisibleRef = useRef(visible);
  if (prevVisibleRef.current !== visible) {
    if (visible) scannedRef.current = false;
    prevVisibleRef.current = visible;
  }

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    log.info("scan successful", { bytes: data.length });
    onScanned(data);
    onClose();
  };

  const renderContent = () => {
    if (!permission?.granted) {
      return (
        <CameraPermissionState permission={permission} requestPermission={requestPermission} />
      );
    }

    // Camera + overlay
    return (
      <View className="flex-1">
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleBarcodeScanned}
        />

        {/* Scrim — dims everything outside the scan window */}
        <View className="absolute inset-0" pointerEvents="none">
          <View className="flex-1 bg-black/40" />
          <View className="h-72 flex-row">
            <View className="flex-1 bg-black/40" />
            <View className="w-72" />
            <View className="flex-1 bg-black/40" />
          </View>
          <View className="flex-1 bg-black/40" />
        </View>

        {/* Viewfinder corners */}
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <View className="h-72 w-72">
            <View
              className="absolute left-0 top-0 h-10 w-10 border-l-4 border-t-4"
              style={{ borderColor: colors.neutral.white }}
            />
            <View
              className="absolute right-0 top-0 h-10 w-10 border-r-4 border-t-4"
              style={{ borderColor: colors.neutral.white }}
            />
            <View
              className="absolute bottom-0 left-0 h-10 w-10 border-b-4 border-l-4"
              style={{ borderColor: colors.neutral.white }}
            />
            <View
              className="absolute bottom-0 right-0 h-10 w-10 border-b-4 border-r-4"
              style={{ borderColor: colors.neutral.white }}
            />
          </View>
        </View>

        <View
          pointerEvents="none"
          className="absolute self-center"
          style={{ top: height / 2 - 144 - 50 }} // center - half of frame - offset
        >
          <View className="rounded-full border border-white/20 bg-white/10 px-5 py-2.5">
            <Text className="text-sm font-medium text-white">
              {t("measurementFlow:qrScanner.alignPrompt")}
            </Text>
          </View>
        </View>

        {/* Optional note below */}
        {showMatchNote && (
          <View
            pointerEvents="none"
            className="absolute bottom-10 mx-10 flex-row items-center gap-2.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-3"
          >
            <Info size={18} color="rgba(255,255,255,0.9)" />
            <Text className="flex-1 text-xs leading-5 text-white">
              {t("measurementFlow:qrScanner.matchNote")}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View className="bg-background flex-1">
        <TouchableOpacity
          className={closeButtonVariants({ cameraActive: !!permission?.granted })}
          onPress={onClose}
        >
          <X size={24} color={colors.neutral.white} />
        </TouchableOpacity>

        {renderContent()}
      </View>
    </Modal>
  );
}
