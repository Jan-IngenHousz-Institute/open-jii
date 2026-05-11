import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePythonRuntimeStore } from "~/stores/python-runtime-store";

import {
  getPythonRuntimeDirUri,
  installPythonRuntime,
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
// stand-in for the surface the installer uses. `downloadFileAsync` is a
// vi.fn() so individual tests can make specific files fail without touching
// the network.
let sentinelExists = false;
let dirExists = false;
const fileSystemActions: string[] = [];
const downloadCalls: string[] = [];
let downloadBehavior: (url: string) => Promise<void> = () => Promise.resolve();

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
    static async downloadFileAsync(url: string, _dest: unknown): Promise<FakeFile> {
      downloadCalls.push(url);
      await downloadBehavior(url);
      return new FakeFile(url);
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

const EXPECTED_FILE_COUNT = 12; // 5 core + 7 packages

describe("python-runtime-installer", () => {
  beforeEach(() => {
    usePythonRuntimeStore.getState().reset();
    dirExists = false;
    sentinelExists = false;
    fileSystemActions.length = 0;
    downloadCalls.length = 0;
    downloadBehavior = () => Promise.resolve();
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

  it("install downloads every required file and ends in 'ready' with progress=1", async () => {
    await installPythonRuntime();

    const current = usePythonRuntimeStore.getState();
    expect(current.state).toBe("ready");
    expect(current.progress).toBe(1);
    expect(current.error).toBeUndefined();
    expect(downloadCalls.length).toBe(EXPECTED_FILE_COUNT);
    expect(sentinelExists).toBe(true);
    expect(fileSystemActions).toContain("dir.create");
  });

  it("install fetches all 12 files from the pinned Pyodide CDN", async () => {
    await installPythonRuntime();
    expect(
      downloadCalls.every((url) =>
        url.startsWith("https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"),
      ),
    ).toBe(true);
  });

  it("install transitions to 'failed' and captures the error when a download throws", async () => {
    downloadBehavior = (url) => {
      if (url.endsWith("scipy-1.11.2-cp311-cp311-emscripten_3_1_45_wasm32.whl")) {
        return Promise.reject(new Error("network unreachable"));
      }
      return Promise.resolve();
    };

    await expect(installPythonRuntime()).rejects.toThrow("network unreachable");

    const current = usePythonRuntimeStore.getState();
    expect(current.state).toBe("failed");
    expect(current.error).toBe("network unreachable");
    expect(sentinelExists).toBe(false);
  });

  it("concurrent install() calls share one active install and run downloads once", async () => {
    let resolveGate = () => undefined as void;
    const gate = new Promise<void>((res) => {
      resolveGate = () => res();
    });
    downloadBehavior = () => gate;

    const a = installPythonRuntime();
    const b = installPythonRuntime();

    resolveGate();
    await Promise.all([a, b]);

    // Functional dedup: a second install while one is active does not double the
    // download count. (Identity check `a === b` would fail because `async`
    // wraps a returned promise in a fresh outer promise even when the body
    // returns an existing promise — the dedup is in the file ops, not refs.)
    expect(downloadCalls.length).toBe(EXPECTED_FILE_COUNT);
    expect(usePythonRuntimeStore.getState().state).toBe("ready");
  });

  it("install retries cleanly after a previous failure: dir is recreated and prior partials are gone", async () => {
    downloadBehavior = () => Promise.reject(new Error("disk full"));
    await expect(installPythonRuntime()).rejects.toThrow("disk full");
    expect(usePythonRuntimeStore.getState().state).toBe("failed");

    downloadBehavior = () => Promise.resolve();
    await installPythonRuntime();

    expect(usePythonRuntimeStore.getState().state).toBe("ready");
    // dir.create runs on each install attempt (we wipe before each).
    expect(fileSystemActions.filter((a) => a === "dir.create").length).toBe(2);
  });
});
