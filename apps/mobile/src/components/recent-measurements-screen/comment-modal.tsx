import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { clsx } from "clsx";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
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
  const sheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      setText(initialText);
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible, initialText]);

  const handleSave = () => {
    onSave(text);
  };

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      onDismiss={onCancel}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.inactive }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetView className="px-4 pb-8 pt-2">
        <Text className={clsx("mb-3 text-lg font-semibold", classes.text)}>Comment</Text>
        <BottomSheetTextInput
          value={text}
          onChangeText={setText}
          placeholder="Add a comment..."
          placeholderTextColor={colors.inactive}
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
      </BottomSheetView>
    </BottomSheetModal>
  );
}
