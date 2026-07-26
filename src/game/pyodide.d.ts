// Ambient types for the Pyodide runtime, loaded at combat-time from the
// jsdelivr CDN (see pyodideRuntime.ts) rather than bundled — the real
// "pyodide" npm package ships several MB of wasm/data assets that need
// special Vite asset handling, which isn't worth it for an MVP that only
// needs runPython + a couple of globals.
export interface PyodideInterface {
  runPython: (code: string) => unknown
  globals: {
    set: (name: string, value: unknown) => void
  }
  setStdout: (options: { batched?: (msg: string) => void }) => void
  setStderr: (options: { batched?: (msg: string) => void }) => void
}

declare global {
  interface Window {
    loadPyodide?: (config?: { indexURL?: string }) => Promise<PyodideInterface>
  }
}
