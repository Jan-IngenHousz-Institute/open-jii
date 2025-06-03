import axios from "axios";

export interface UserSessionData {
  user: {
    name: string;
    email: string;
    image: string;
    id: string;
  };
  expires: string; // ISO 8601 date string
}

const axiosInstance = axios.create({
  baseURL: "http://localhost:3000",
  withCredentials: false,
  headers: {
    Cookie: "",
  },
});

export async function getSession(sessionToken: string) {
  const { data } = await axiosInstance.get<UserSessionData>(
    "http://localhost:3000/api/auth/session",
    {
      headers: {
        Accept: "*/*",
        Cookie: `authjs.session-token=${sessionToken}`,
      },
    },
  );

  return data;
}
