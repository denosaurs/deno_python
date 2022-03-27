import type { Python } from "./python.ts";

/** A class for typing the modules without unsafe name resolution. */
export class PythonLoader<
  ModuleMap extends Record<string, Record<string, unknown>> = Record<
    never,
    never
  >,
> {
  #py: Python;

  constructor(py: Python) {
    this.#py = py;
  }

  /**
   * Imports the given module with smart type inference on the type of the
   * module.
   */
  import<Name extends keyof ModuleMap>(name: Name): ModuleMap[Name] {
    return this.#py.import(name as any);
  }
}
