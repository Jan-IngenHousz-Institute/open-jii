import clsx from "clsx";
import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { create } from "zustand";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";

interface AlertButton {
  text: string;
  onPress?: () => void;
  variant?: "primary" | "ghost" | "danger";
}

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
}

interface AlertStore extends AlertState {
  show: (title: string, message: string, buttons?: AlertButton[]) => void;
  hide: () => void;
}

export const useAlertStore = create<AlertStore>((set) => ({
  visible: false,
  title: "",
  message: "",
  buttons: [],
  show: (title, message, buttons) =>
    set({
      visible: true,
      title,
      message,
      buttons: buttons ?? [{ text: "OK", variant: "primary" }],
    }),
  hide: () => set({ visible: false, title: "", message: "", buttons: [] }),
}));

export function showAlert(title: string, message: string, buttons?: AlertButton[]) {
  useAlertStore.getState().show(title, message, buttons);
}

export function AlertDialog() {
  const { visible, title, message, buttons, hide } = useAlertStore();
  const { classes, colors } = useTheme();

  const handlePress = (button: AlertButton) => {
    hide();
    button.onPress?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Pressable className="flex-1 items-center justify-center bg-black/50" onPress={hide}>
        <Pressable
          className={clsx("w-[85%] max-w-sm rounded-2xl p-4", classes.card)}
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="mb-2 text-left text-lg font-semibold">{title}</Text>
          <Text className="mb-4 text-left text-sm font-normal">{message}</Text>

          <View className="gap-4">
            {buttons.map((button, index) => {
              return (
                <Button
                  key={index}
                  title={button.text}
                  variant={button.variant}
                  textStyle={
                    button.variant === "ghost" ? { color: colors.neutral.black } : undefined
                  }
                  onPress={() => handlePress(button)}
                />
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
