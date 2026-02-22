import { clsx } from "clsx";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";

interface CommentModalProps {
  visible: boolean;
  initialText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}

export function CommentModal({ visible, initialText, onSave, onCancel }: CommentModalProps) {
  const { colors, classes } = useTheme();
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (visible) setText(initialText);
  }, [visible, initialText]);

  const handleSave = () => {
    onSave(text);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-center px-4"
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      >
        <View
          className={clsx("rounded-xl border p-4", classes.card, classes.border)}
          style={{ backgroundColor: colors.surface }}
        >
          <Text className={clsx("mb-3 text-lg font-semibold", classes.text)}>Comment</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Add a comment..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className={clsx(
              "min-h-[100px] rounded-lg border px-3 py-2 text-base",
              classes.border,
              classes.text,
            )}
            style={{
              backgroundColor: colors.background,
              color: colors.onSurface,
            }}
          />
          <View className="mt-4 flex-row gap-3">
            <Button title="Cancel" variant="outline" onPress={onCancel} style={{ flex: 1 }} />
            <Button title="Save comment" onPress={handleSave} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
