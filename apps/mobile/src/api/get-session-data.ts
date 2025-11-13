import axios from "axios";
import { getEnvName, getEnvVar } from "~/stores/environment-store";

export interface UserSessionData {
  user: {
    name: string;
    email: string;
    image: string;
    id: string;
  };
  expires: string; // ISO 8601 date string
}

export async function getSessionData(sessionToken: string) {
  const axiosInstance = axios.create({
    baseURL: getEnvVar("NEXT_AUTH_URI"),
    withCredentials: false,
    headers: {
      Cookie: "",
    },
  });

  const envName = String(getEnvName());

  const { data } = await axiosInstance.get<UserSessionData>("/api/auth/session", {
    headers: {
      Accept: "*/*",
      Cookie: `__Secure-authjs.${envName}.session-token=${sessionToken}`,
    },
  });

  return data;
}
