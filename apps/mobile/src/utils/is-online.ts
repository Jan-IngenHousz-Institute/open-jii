import axios from "axios";

const PING_URL = "https://clients3.google.com/generate_204";

export async function isOnline(): Promise<boolean> {
  try {
    await axios.head(PING_URL, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

