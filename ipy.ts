import py, { Python } from "./mod.ts";
import { Pip, pip } from "./ext/pip.ts";

declare global {
  const py: Python;
  const pip: Pip;
}

Object.defineProperty(globalThis, "py", {
  value: py,
  writable: false,
  enumerable: false,
  configurable: false,
});

Object.defineProperty(globalThis, "pip", {
  value: pip,
  writable: false,
  enumerable: false,
  configurable: false,
});

export * from "./mod.ts";
export * from "./ext/pip.ts";
export default py;
