import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePythonRuntimeStore } from "~/stores/python-runtime-store";

import {
  getPythonRuntimeDirUri,
  isPythonRuntimeReady,
  reconcilePythonRuntimeState,
  uninstallPythonRuntime,
} from "./python-runtime-installer";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    setItem: vi.fn(() => Promise.resolve()),
    getItem: vi.fn(() => Promise.resolve(null)),
    removeItem: vi.fn(() => Promise.resolve()),
  },
}));

// `expo-file-system` reaches into native code; provide a minimal in-memory
// stand-in for the surface the installer uses.
let sentinelExists = false;
let dirExists = false;
const fileSystemActions: string[] = [];

vi.mock("expo-file-system", () => {
  class FakeDirectory {
    uri: string;
    constructor(...parts: (string | FakeDirectory | FakeFile)[]) {
      this.uri = "file:///mock/document/pyodide/";
      void parts;
    }
    get exists() {
      return dirExists;
    }
    create() {
      dirExists = true;
      sentinelExists = false;
      fileSystemActions.push("dir.create");
    }
    delete() {
      dirExists = false;
      sentinelExists = false;
      fileSystemActions.push("dir.delete");
    }
  }

  class FakeFile {
    uri: string;
    constructor(...parts: (string | FakeDirectory | FakeFile)[]) {
      const last = parts[parts.length - 1];
      this.uri = `file:///mock/document/pyodide/${typeof last === "string" ? last : "file"}`;
    }
    get exists() {
      return this.uri.endsWith(".install-complete-v1") ? sentinelExists : false;
    }
    create() {
      if (this.uri.endsWith(".install-complete-v1")) sentinelExists = true;
    }
    write() {
      // no-op
    }
    delete() {
      if (this.uri.endsWith(".install-complete-v1")) sentinelExists = false;
    }
  }

  return {
    Directory: FakeDirectory,
    File: FakeFile,
    Paths: {
      document: new FakeDirectory(),
    },
  };
});

describe("python-runtime-installer", () => {
  beforeEach(() => {
    usePythonRuntimeStore.getState().reset();
    dirExists = false;
    sentinelExists = false;
    fileSystemActions.length = 0;
  });

  it("getPythonRuntimeDirUri always ends with a trailing slash", () => {
    expect(getPythonRuntimeDirUri()).toMatch(/\/$/);
  });

  it("isPythonRuntimeReady reports false until the store says ready and the sentinel exists", () => {
    expect(isPythonRuntimeReady()).toBe(false);

    usePythonRuntimeStore.getState().setState("ready");
    expect(isPythonRuntimeReady()).toBe(false); // sentinel missing
    sentinelExists = true;
    expect(isPythonRuntimeReady()).toBe(true);
  });

  it("reconcile drops 'ready' back to 'absent' when the sentinel is gone", () => {
    usePythonRuntimeStore.getState().setState("ready");
    sentinelExists = false;

    reconcilePythonRuntimeState();

    expect(usePythonRuntimeStore.getState().state).toBe("absent");
  });

  it("reconcile preserves 'ready' when the sentinel is intact", () => {
    usePythonRuntimeStore.getState().setState("ready");
    sentinelExists = true;

    reconcilePythonRuntimeState();

    expect(usePythonRuntimeStore.getState().state).toBe("ready");
  });

  it("reconcile resets a stale 'installing' state from a previous crash", () => {
    usePythonRuntimeStore.getState().setState("installing");
    usePythonRuntimeStore.getState().setProgress(0.42);

    reconcilePythonRuntimeState();

    const current = usePythonRuntimeStore.getState();
    expect(current.state).toBe("absent");
    expect(current.progress).toBe(0);
  });

  it("uninstall deletes the directory and resets the store", () => {
    usePythonRuntimeStore.getState().setState("ready");
    dirExists = true;
    sentinelExists = true;

    uninstallPythonRuntime();

    expect(usePythonRuntimeStore.getState().state).toBe("absent");
    expect(dirExists).toBe(false);
    expect(fileSystemActions).toContain("dir.delete");
  });

  it("uninstall is a no-op for the filesystem when nothing was installed", () => {
    uninstallPythonRuntime();
    expect(fileSystemActions).not.toContain("dir.delete");
    expect(usePythonRuntimeStore.getState().state).toBe("absent");
  });
});
