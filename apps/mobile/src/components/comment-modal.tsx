import { clsx } from "clsx";
import { X } from "lucide-react-native";
import React, { useState, useEffect } from "react";
import { Modal, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";
import {
  getMeasurementComment,
  saveMeasurementComment,
} from "~/services/measurement-comments-storage";

interface CommentModalProps {
  visible: boolean;
  measurementKey: string;
  onClose: () => void;
  onSave?: () => void;
}

export function CommentModal({ visible, measurementKey, onClose, onSave }: CommentModalProps) {
  const { colors, classes } = useTheme();
  const insets = useSafeAreaInsets();
  const [comment, setComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible && measurementKey) {
      loadComment();
    } else {
      setComment("");
    }
  }, [visible, measurementKey]);

  const loadComment = async () => {
    try {
      const existingComment = await getMeasurementComment(measurementKey);
      setComment(existingComment || "");
    } catch (error) {
      console.error("Failed to load comment:", error);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await saveMeasurementComment(measurementKey, comment);
      onSave?.();
      onClose();
    } catch (error) {
      console.error("Failed to save comment:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View
        className={clsx("flex-1", classes.background)}
        style={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        {/* Header */}
        <View
          className={clsx("flex-row items-center justify-between border-b p-4", classes.border)}
        >
          <Text className={clsx("text-lg font-bold", classes.text)}>Comment</Text>
          <TouchableOpacity
            onPress={onClose}
            className="ml-4 h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.surface }}
            activeOpacity={0.7}
          >
            <X size={20} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View className="flex-1 p-4">
          <Text className={clsx("mb-2 text-sm", classes.textSecondary)}>
            Add a comment to this measurement
          </Text>
          <TextInput
            className={clsx("flex-1 rounded-lg border p-4", classes.border)}
            style={{
              backgroundColor: colors.surface,
              color: colors.onSurface,
              textAlignVertical: "top",
            }}
            placeholder="Enter your comment..."
            placeholderTextColor={colors.onSurface + "80"}
            multiline
            value={comment}
            onChangeText={setComment}
            autoFocus
          />
        </View>

        {/* Footer */}
        <View
          className={clsx("border-t p-4", classes.border)}
          style={{ backgroundColor: colors.surface }}
        >
          <View className="flex-row gap-3">
            <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Save" onPress={handleSave} isLoading={isLoading} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
