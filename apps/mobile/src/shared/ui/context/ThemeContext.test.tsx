import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, waitFor } from "@testing-library/react-native";
import React, { useContext } from "react";
import { Text } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lightTheme } from "~/shared/constants/theme";

import { ThemeContext, ThemeContextValue, ThemeProvider } from "./ThemeContext";

const { colorSchemeSetMock, asyncStorageStore } = vi.hoisted(() => ({
  colorSchemeSetMock: vi.fn(),
  asyncStorageStore: {
    value: null as string | null,
    getError: null as Error | null,
    setError: null as Error | null,
  },
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

const Probe: React.FC<{ onRender: (theme: ThemeContextValue) => void }> = ({ onRender }) => {
  const themeCtx = useContext(ThemeContext);
  onRender(themeCtx);
  return <Text>{themeCtx.isDark === true ? "dark" : "light"}</Text>;
};

const renderWithProvider = () => {
  let latest: ThemeContextValue | undefined;
  const utils = render(
    <ThemeProvider>
      <Probe onRender={(t) => (latest = t)} />
    </ThemeProvider>,
  );
  return {
    ...utils,
    getTheme: () => {
      if (!latest) throw new Error("Probe did not render");
      return latest;
    },
  };
};

beforeEach(() => {
  asyncStorageStore.value = null;
  asyncStorageStore.getError = null;
  asyncStorageStore.setError = null;
  colorSchemeSetMock.mockClear();
  vi.mocked(AsyncStorage.getItem).mockClear();
  vi.mocked(AsyncStorage.setItem).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ThemeProvider", () => {
  it("defaults to light theme when no preference is saved", async () => {
    const { getTheme } = renderWithProvider();
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalledWith("themePreference"));
    expect(getTheme().themePreference).toBe("light");
    expect(getTheme().isDark).toBe(false);
    expect(getTheme().classes).toEqual(lightTheme.classes);
    expect(colorSchemeSetMock).toHaveBeenLastCalledWith("light");
  });

  it("loads saved 'dark' preference from AsyncStorage", async () => {
    asyncStorageStore.value = "dark";
    const { getTheme } = renderWithProvider();
    await waitFor(() => expect(getTheme().themePreference).toBe("dark"));
    expect(getTheme().isDark).toBe(true);
    expect(colorSchemeSetMock).toHaveBeenLastCalledWith("dark");
  });

  it("loads saved 'light' preference from AsyncStorage", async () => {
    asyncStorageStore.value = "light";
    const { getTheme } = renderWithProvider();
    await waitFor(() => expect(getTheme().themePreference).toBe("light"));
    expect(getTheme().isDark).toBe(false);
    expect(colorSchemeSetMock).toHaveBeenLastCalledWith("light");
  });

  it("ignores stale 'system' value in AsyncStorage and keeps light default", async () => {
    asyncStorageStore.value = "system";
    const { getTheme } = renderWithProvider();
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalledWith("themePreference"));
    expect(getTheme().themePreference).toBe("light");
    expect(getTheme().isDark).toBe(false);
  });

  it("persists changeTheme to AsyncStorage and updates theme", async () => {
    const { getTheme } = renderWithProvider();
    await waitFor(() => expect(getTheme().themePreference).toBe("light"));

    await act(async () => {
      await getTheme().changeTheme("dark");
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith("themePreference", "dark");
    await waitFor(() => expect(getTheme().themePreference).toBe("dark"));
    expect(getTheme().isDark).toBe(true);
    expect(colorSchemeSetMock).toHaveBeenLastCalledWith("dark");
  });

  it("logs error and stays on light when AsyncStorage.getItem rejects", async () => {
    asyncStorageStore.getError = new Error("read fail");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { getTheme } = renderWithProvider();
    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith(expect.any(Error)));
    expect(getTheme().themePreference).toBe("light");
    expect(getTheme().isDark).toBe(false);
  });

  it("logs error and does not change preference when AsyncStorage.setItem rejects", async () => {
    const { getTheme } = renderWithProvider();
    await waitFor(() => expect(getTheme().themePreference).toBe("light"));
    asyncStorageStore.setError = new Error("write fail");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await act(async () => {
      await getTheme().changeTheme("dark");
    });

    expect(errorSpy).toHaveBeenCalledWith("Failed to save theme preference:", expect.any(Error));
    expect(getTheme().themePreference).toBe("light");
  });
});
