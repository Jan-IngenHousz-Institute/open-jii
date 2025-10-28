import axios from "axios";
import { assertEnvVariables } from "~/utils/assert";

export interface UserSessionData {
  user: {
    name: string;
    email: string;
    image: string;
    id: string;
  };
  expires: string; // ISO 8601 date string
}

const { NEXT_AUTH_URI } = assertEnvVariables({
  NEXT_AUTH_URI: process.env.NEXT_AUTH_URI,
});

const axiosInstance = axios.create({
  baseURL: NEXT_AUTH_URI,
  withCredentials: false,
  headers: {
    Cookie: "",
  },
});

export async function getSessionData(sessionToken: string) {
  const { data } = await axiosInstance.get<UserSessionData>("/api/auth/session", {
    headers: {
      Accept: "*/*",
      Cookie: `__Secure-authjs.dev.session-token=${sessionToken}`,
    },
  });

  return data;
}
