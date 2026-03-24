import { cva } from "class-variance-authority";
import clsx from "clsx";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Camera, CameraOff, ShieldAlert, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";

const iconBadgeVariants = cva("h-20 w-20 items-center justify-center rounded-full border", {
  variants: {
    permanentlyDenied: {
      false: "bg-[#E2FCFC] border-[#005E5E]",
      true: "bg-[#FFE5E5] border-[#DC2626]",
    },
  },
  defaultVariants: {
    permanentlyDenied: false,
  },
});

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
}

export function QRScannerModal({ visible, onClose, onScanned }: QRScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const { colors, classes } = useTheme();

  // Reset scan state whenever the modal becomes visible
  useEffect(() => {
    if (visible) {
      setScanned(false);
    }
  }, [visible]);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    console.log("QR code scanned:", data);
    onScanned(data);
    onClose();
  };

  const renderContent = () => {
    if (!permission) {
      return (
        <View className="flex-1 items-center justify-center gap-6 px-8">
          <View className={iconBadgeVariants({ permanentlyDenied: false })}>
            <Camera size={40} color={colors.primary.dark} />
          </View>
          <View className="items-center gap-2">
            <Text className={clsx("text-xl font-bold", classes.text)}>Starting camera</Text>
            <Text className={clsx("text-center text-sm", classes.textMuted)}>
              Please wait while the camera initialises…
            </Text>
          </View>
          <ActivityIndicator size="large" color={colors.primary.dark} />
        </View>
      );
    }

    if (!permission.granted) {
      const permanentlyDenied = !permission.canAskAgain;

      return (
        <View className="flex-1 items-center justify-center gap-6 px-8">
          {/* Icon badge */}
          <View className={iconBadgeVariants({ permanentlyDenied })}>
            {permanentlyDenied ? (
              <ShieldAlert size={40} color={"#DC2626"} />
            ) : (
              <CameraOff size={40} color={colors.primary.dark} />
            )}
          </View>

          {/* Text block */}
          <View className="items-center gap-2">
            <Text className={clsx("text-xl font-bold", classes.text)}>
              {permanentlyDenied ? "Permission disabled" : "Camera access required"}
            </Text>
            <Text className={clsx("text-center text-sm leading-5", classes.textMuted)}>
              {permanentlyDenied
                ? "Camera access has been permanently denied. Open your device settings to enable it for openJII."
                : "openJII needs access to your camera to scan QR codes."}
            </Text>
          </View>

          {/* Action */}
          {!permanentlyDenied ? (
            <Button onPress={requestPermission} title="Grant permission" variant="primary" />
          ) : (
            <Button
              onPress={() => Linking.openSettings()}
              title="Open settings"
              variant="outline"
            />
          )}
        </View>
      );
    }

    // Camera + overlay
    return (
      <View className="flex-1">
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleBarcodeScanned}
        />

        {/* Overlay only when camera is ready */}
        <View className="absolute inset-0 items-center justify-center" pointerEvents="box-none">
          {/* Viewfinder */}
          <View className="items-center gap-5" pointerEvents="none">
            <View className="h-60 w-60">
              <View
                className="absolute left-0 top-0 h-6 w-6 border-l-[3px] border-t-[3px]"
                style={{ borderColor: colors.neutral.white }}
              />
              <View
                className="absolute right-0 top-0 h-6 w-6 border-r-[3px] border-t-[3px]"
                style={{ borderColor: colors.neutral.white }}
              />
              <View
                className="absolute bottom-0 left-0 h-6 w-6 border-b-[3px] border-l-[3px]"
                style={{ borderColor: colors.neutral.white }}
              />
              <View
                className="absolute bottom-0 right-0 h-6 w-6 border-b-[3px] border-r-[3px]"
                style={{ borderColor: colors.neutral.white }}
              />
            </View>

            <Text className="text-sm text-white opacity-80">Align a QR code within the frame</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <TouchableOpacity
          className="absolute right-5 top-14 z-10 rounded-full bg-black/50 p-2"
          onPress={onClose}
        >
          <X size={24} color={colors.neutral.white} />
        </TouchableOpacity>

        {renderContent()}
      </View>
    </Modal>
  );
}
