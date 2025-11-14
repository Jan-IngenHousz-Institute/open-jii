import { createAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";

import successSound from "../../assets/success.mp3";

const player = createAudioPlayer(successSound);

export async function playSound() {
  try {
    // Pause and reset the player to ensure it can play from the beginning
    // If the player is already paused, pause() might throw, so we catch and continue
    try {
      player.pause();
    } catch {
      // Player might not be playing, which is fine
    }
    try {
      await player.seekTo(0);
    } catch {
      // seekTo might fail if not supported, which is fine
    }
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
