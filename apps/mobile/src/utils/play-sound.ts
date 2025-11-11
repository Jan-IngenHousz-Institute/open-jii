import { createAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";

import successSound from "../../assets/success.mp3";

const player = createAudioPlayer(successSound);

export async function playSound() {
  try {
    player.play();
  } catch (error) {
    console.error("Error playing sound:", error);
  }

  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    console.error("Error playing haptic feedback:", error);
  }
}
