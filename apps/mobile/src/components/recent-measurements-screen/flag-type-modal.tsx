import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { clsx } from "clsx";
import { Check, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type AnnotationFlagType } from "@repo/api";
import { useTheme } from "~/hooks/use-theme";


const FLAG_OPTIONS: { value: AnnotationFlagType; label: string }[] = [
  { value: "outlier", label: "Outlier" },
  { value: "needs_review", label: "Needs Review" },
];

interface FlagTypeModalProps {
  visible: boolean;
  selected: AnnotationFlagType | null;
  onSelect: (flagType: AnnotationFlagType | null) => void;
  onCancel: () => void;
}

export function FlagTypeModal({ visible, selected, onSelect, onCancel }: FlagTypeModalProps) {
  const { colors, classes } = useTheme();
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  useEffect(() => {
    const onBackPress = () => {
      if (visible) {
        sheetRef.current?.dismiss();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [visible]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      onDismiss={onCancel}
      handleIndicatorStyle={{ backgroundColor: colors.inactive }}
      stackBehavior="push"
    >
      <BottomSheetView className="gap-2 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
        <View className="flex-row items-center justify-between pb-2">
          <Text className={clsx("text-lg font-bold", classes.text)}>Select flag type</Text>
          <TouchableOpacity onPress={onCancel} className="p-1">
            <X size={24} color={colors.neutral.black} />
          </TouchableOpacity>
        </View>

        {FLAG_OPTIONS.map(({ value, label }) => (
          <TouchableOpacity
            key={value}
            onPress={() => onSelect(value)}
            className={clsx(
              "flex-row items-center justify-between rounded-xl px-4 py-3",
              selected === value ? "bg-[#EDF2F6]" : "",
            )}
            activeOpacity={0.7}
          >
            <Text className={clsx("text-base", classes.text)}>{label}</Text>
            {selected === value && <Check size={18} color={colors.onSurface} />}
          </TouchableOpacity>
        ))}

        {selected && (
          <TouchableOpacity
            onPress={() => onSelect(null)}
            className="mt-1 items-center py-2"
            activeOpacity={0.7}
          >
            <Text className={clsx("text-sm", classes.textMuted)}>Remove flag</Text>
          </TouchableOpacity>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
