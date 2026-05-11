import { act, render, waitFor } from "@testing-library/react-native";
import React, { useContext } from "react";
import { Text, useColorScheme } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { darkTheme, lightTheme } from "~/constants/theme";

const { colorSchemeSetMock, asyncStorageStore } = vi.hoisted(() => ({
  colorSchemeSetMock: vi.fn(),
  asyncStorageStore: { value: null as string | null, getError: null as Error | null, setError: null as Error | null },
}));

vi.mock("nativewind", () => ({
  useColorScheme: () => ({
    colorScheme: "light",
    setColorScheme: () => undefined,
    toggleColorScheme: () => undefined,
  }),
  colorScheme: {
    get: () => "light",
    set: colorSchemeSetMock,
  },
  vars: (input: Record<string, string>) => input,
  cssInterop: () => undefined,
  remapProps: () => undefined,
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(() => {
      if (asyncStorageStore.getError) return Promise.reject(asyncStorageStore.getError);
      return Promise.resolve(asyncStorageStore.value);
    }),
    setItem: vi.fn((_key: string, value: string) => {
      if (asyncStorageStore.setError) return Promise.reject(asyncStorageStore.setError);
      asyncStorageStore.value = value;
      return Promise.resolve();
    }),
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeContext, ThemeProvider } from "./ThemeContext";

type EnhancedTheme = typeof lightTheme & {
  changeTheme: (pref: "system" | "light" | "dark") => Promise<void>;
  themePreference: "system" | "light" | "dark";
};

const Probe: React.FC<{ onRender: (theme: EnhancedTheme) => void }> = ({ onRender }) => {
  const themeCtx = useContext(ThemeContext) as EnhancedTheme;
  onRender(themeCtx);
  const darkActive = themeCtx.isDark;
  return <Text>{darkActive === true ? "dark" : "light"}</Text>;
};

const renderWithProvider = () => {
  let latest: EnhancedTheme | undefined;
  const utils = render(
    <ThemeProvider>
      <Probe onRender={(t) => (latest = t)} />
    </ThemeProvider>,
  );
  return { ...utils, getTheme: () => latest! };
};

beforeEach(() => {
  asyncStorageStore.value = null;
  asyncStorageStore.getError = null;
  asyncStorageStore.setError = null;
  vi.mocked(useColorScheme).mockReturnValue("light");
  colorSchemeSetMock.mockClear();
  vi.mocked(AsyncStorage.getItem).mockClear();
  vi.mocked(AsyncStorage.setItem).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ThemeProvider", () => {
  it("defaults to light theme when no preference is saved and system is light", async () => {
    const { getTheme } = renderWithProvider();
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalledWith("themePreference"));
    await waitFor(() => expect(getTheme().themePreference).toBe("system"));
    expect(getTheme().isDark).toBe(false);
    expect(getTheme().classes).toEqual(lightTheme.classes);
    expect(colorSchemeSetMock).toHaveBeenLastCalledWith("light");
  });

  it("resolves system preference to dark when OS reports dark", async () => {
    vi.mocked(useColorScheme).mockReturnValue("dark");
    const { getTheme } = renderWithProvider();
    await waitFor(() => expect(getTheme().isDark).toBe(true));
    expect(getTheme().classes).toEqual(darkTheme.classes);
    expect(colorSchemeSetMock).toHaveBeenLastCalledWith("dark");
  });

  it("loads saved 'dark' preference from AsyncStorage and ignores OS scheme", async () => {
    asyncStorageStore.value = "dark";
    vi.mocked(useColorScheme).mockReturnValue("light");
    const { getTheme } = renderWithProvider();
    await waitFor(() => expect(getTheme().themePreference).toBe("dark"));
    expect(getTheme().isDark).toBe(true);
    expect(colorSchemeSetMock).toHaveBeenLastCalledWith("dark");
  });

  it("loads saved 'light' preference from AsyncStorage and ignores OS scheme", async () => {
    asyncStorageStore.value = "light";
    vi.mocked(useColorScheme).mockReturnValue("dark");
    const { getTheme } = renderWithProvider();
    await waitFor(() => expect(getTheme().themePreference).toBe("light"));
    expect(getTheme().isDark).toBe(false);
    expect(colorSchemeSetMock).toHaveBeenLastCalledWith("light");
  });

  it("persists changeTheme to AsyncStorage and updates theme", async () => {
    const { getTheme } = renderWithProvider();
    await waitFor(() => expect(getTheme().themePreference).toBe("system"));

    await act(async () => {
      await getTheme().changeTheme("dark");
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith("themePreference", "dark");
    await waitFor(() => expect(getTheme().themePreference).toBe("dark"));
    expect(getTheme().isDark).toBe(true);
    expect(colorSchemeSetMock).toHaveBeenLastCalledWith("dark");
  });

  it("logs and stays on default theme when AsyncStorage.getItem rejects", async () => {
    asyncStorageStore.getError = new Error("read fail");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { getTheme } = renderWithProvider();
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        "Failed to load theme preference:",
        expect.any(Error),
      ),
    );
    expect(getTheme().themePreference).toBe("system");
    expect(getTheme().isDark).toBe(false);
  });

  it("logs and does not change preference when AsyncStorage.setItem rejects", async () => {
    const { getTheme } = renderWithProvider();
    await waitFor(() => expect(getTheme().themePreference).toBe("system"));
    asyncStorageStore.setError = new Error("write fail");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await act(async () => {
      await getTheme().changeTheme("dark");
    });

    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to save theme preference:",
      expect.any(Error),
    );
    expect(getTheme().themePreference).toBe("system");
  });

  it("reacts to system color scheme changes while preference is 'system'", async () => {
    const { getTheme, rerender } = renderWithProvider();
    await waitFor(() => expect(getTheme().isDark).toBe(false));

    vi.mocked(useColorScheme).mockReturnValue("dark");
    rerender(
      <ThemeProvider>
        <Probe onRender={() => undefined} />
      </ThemeProvider>,
    );
    await waitFor(() => expect(colorSchemeSetMock).toHaveBeenLastCalledWith("dark"));
  });
});
