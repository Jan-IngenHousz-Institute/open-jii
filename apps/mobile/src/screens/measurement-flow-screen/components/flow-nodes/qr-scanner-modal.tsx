import { cva } from "class-variance-authority";
import clsx from "clsx";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Camera, CameraOff, Info, ShieldAlert, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
  Dimensions,
} from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";

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
  showMatchNote?: boolean;
}

export function QRScannerModal({
  visible,
  onClose,
  onScanned,
  showMatchNote,
}: QRScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const { colors, classes } = useTheme();
  const { height } = Dimensions.get("window");
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
            <Text className="text-sm font-medium text-white">Align a QR code within the frame</Text>
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
              The QR code must match exactly one of the available options.
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 bg-white">
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
