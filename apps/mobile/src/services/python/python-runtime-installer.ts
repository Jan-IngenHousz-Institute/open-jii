import { Directory, File, Paths } from "expo-file-system";
import { usePythonRuntimeStore } from "~/stores/python-runtime-store";

const PYODIDE_VERSION = "0.24.1";
const CDN_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full`;
const PYODIDE_DIRNAME = "pyodide";
const SENTINEL_FILENAME = ".install-complete-v1";

const CORE_FILES = [
  "pyodide.js",
  "pyodide.asm.js",
  "pyodide.asm.wasm",
  "pyodide-lock.json",
  "python_stdlib.zip",
];

const PACKAGE_FILES = [
  "numpy-1.25.2-cp311-cp311-emscripten_3_1_45_wasm32.whl",
  "pandas-1.5.3-cp311-cp311-emscripten_3_1_45_wasm32.whl",
  "scipy-1.11.2-cp311-cp311-emscripten_3_1_45_wasm32.whl",
  "python_dateutil-2.8.2-py2.py3-none-any.whl",
  "pytz-2023.3-py2.py3-none-any.whl",
  "six-1.16.0-py2.py3-none-any.whl",
  "openblas-0.3.23.zip",
];

let activeInstall: Promise<void> | null = null;

export class PythonRuntimeNotReadyError extends Error {
  constructor() {
    super("Python macro support is not installed on this device.");
    this.name = "PythonRuntimeNotReadyError";
  }
}

function runtimeDir(): Directory {
  return new Directory(Paths.document, PYODIDE_DIRNAME);
}

function sentinelFile(): File {
  return new File(runtimeDir(), SENTINEL_FILENAME);
}

export function getPythonRuntimeDirUri(): string {
  const uri = runtimeDir().uri;
  return uri.endsWith("/") ? uri : `${uri}/`;
}

export function isPythonRuntimeReady(): boolean {
  if (usePythonRuntimeStore.getState().state !== "ready") return false;
  try {
    return sentinelFile().exists;
  } catch {
    return false;
  }
}

/**
 * Re-check the durable sentinel file at app startup and reconcile the store.
 * If the user wiped app data outside our UI, or an upgrade removed the dir,
 * we drop back to `absent` so the settings toggle reflects reality.
 */
export function reconcilePythonRuntimeState(): void {
  const store = usePythonRuntimeStore.getState();
  if (store.state === "installing") {
    // A previous install was interrupted (crash, force-quit). Reset.
    store.reset();
    return;
  }
  if (store.state === "ready" && !sentinelFile().exists) {
    store.reset();
  }
}

async function downloadOne(filename: string): Promise<void> {
  const dir = runtimeDir();
  const target = new File(dir, filename);
  if (target.exists) target.delete();
  await File.downloadFileAsync(`${CDN_BASE}/${filename}`, target);
}

export async function installPythonRuntime(): Promise<void> {
  if (activeInstall) return activeInstall;

  const store = usePythonRuntimeStore.getState();
  activeInstall = (async () => {
    try {
      store.setError(undefined);
      store.setProgress(0);
      store.setState("installing");

      const dir = runtimeDir();
      if (dir.exists) dir.delete();
      dir.create({ intermediates: true });

      const allFiles = [...CORE_FILES, ...PACKAGE_FILES];
      let done = 0;
      for (const name of allFiles) {
        await downloadOne(name);
        done += 1;
        store.setProgress(done / allFiles.length);
      }

      // TODO: verify package sha256s against the freshly downloaded lock file.
      // Skipped here because expo-file-system v55 does not expose a sync hash
      // primitive; if we add one, do it in a follow-up.

      const sentinel = sentinelFile();
      sentinel.create();
      sentinel.write(new Date().toISOString());

      store.setState("ready");
      store.setProgress(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      store.setError(message);
      store.setState("failed");
      throw err;
    } finally {
      activeInstall = null;
    }
  })();
  return activeInstall;
}

export function uninstallPythonRuntime(): void {
  const dir = runtimeDir();
  if (dir.exists) dir.delete();
  usePythonRuntimeStore.getState().reset();
}
