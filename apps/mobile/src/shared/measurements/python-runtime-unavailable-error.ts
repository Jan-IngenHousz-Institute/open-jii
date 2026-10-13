/** The phone could not load the Python runtime, which it downloads over the network. */
export class PythonRuntimeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PythonRuntimeUnavailableError";
  }
}
