import { kw, python, PythonError } from "../mod.ts";

import { join } from "https://deno.land/std@0.198.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.198.0/fs/mod.ts";
import { green, yellow } from "https://deno.land/std@0.198.0/fmt/colors.ts";

import type { CacheLocation } from "https://deno.land/x/plug@1.0.2/types.ts";
import { ensureCacheLocation } from "https://deno.land/x/plug@1.0.2/download.ts";
import { hash } from "https://deno.land/x/plug@1.0.2/util.ts";

const sys = python.import("sys");
const runpy = python.import("runpy");
const importlib = python.import("importlib");

// https://packaging.python.org/en/latest/specifications/name-normalization/
const MODULE_REGEX =
  /^([a-z0-9]|[a-z0-9][a-z0-9._-]*[a-z0-9])([^a-z0-9._-].*)?$/i;

function normalizeModuleName(name: string) {
  return name.replaceAll(/[-_.]+/g, "-").toLowerCase();
}

function getModuleNameAndVersion(module: string): {
  name: string;
  version?: string;
} {
  const match = module.match(MODULE_REGEX);
  const name = match?.[1];
  const version = match?.[2];

  if (name == null) {
    throw new TypeError("Could not match any valid pip module name");
  }

  return {
    name: normalizeModuleName(name),
    version,
  };
}

export class Pip {
  #cacheLocation: Promise<string>;

  constructor(location: CacheLocation) {
    this.#cacheLocation = Promise.all([
      ensureCacheLocation(location),
      globalThis.location !== undefined
        ? hash(globalThis.location.href)
        : Promise.resolve("pip"),
    ]).then(async (parts) => {
      const cacheLocation = join(...parts);
      await ensureDir(cacheLocation);

      if (!(cacheLocation in sys.path)) {
        sys.path.insert(0, cacheLocation);
      }

      return cacheLocation;
    });
  }

  /**
   * Install a Python module using the `pip` package manager.
   *
   * @param module The Python module which you wish to install
   *
   * @example
   * ```ts
   * import { python } from "https://deno.land/x/python/mod.ts";
   * import { install } from "https://deno.land/x/python/ext/pip.ts";
   *
   * await install("numpy");
   * const numpy = python.import("numpy");
   *
   * ```
   */
  async install(module: string) {
    const argv = sys.argv;
    sys.argv = [
      "pip",
      "install",
      "-q",
      "-t",
      await this.#cacheLocation,
      module,
    ];

    console.log(`${green("Installing")} ${module}`);

    try {
      runpy.run_module("pip", kw`run_name=${"__main__"}`);
    } catch (error) {
      if (
        !(
          error instanceof PythonError &&
          error.type.isInstance(python.builtins.SystemExit()) &&
          error.value.asLong() === 0
        )
      ) {
        throw error;
      }
    } finally {
      sys.argv = argv;
    }
  }

  /**
   * Install and import a Python module using the `pip` package manager.
   *
   * @param module The Python module which you wish to install
   *
   * @example
   * ```ts
   * import { python } from "https://deno.land/x/python/mod.ts";
   * import { pip } from "https://deno.land/x/python/ext/pip.ts";
   *
   * const numpy = await pip.import("numpy==1.25.2");
   *
   * ```
   */
  async import(module: string, entrypoint?: string) {
    const { name } = getModuleNameAndVersion(module);

    await this.install(module);

    if (entrypoint) {
      return python.import(entrypoint);
    }

    const packages = importlib.metadata.packages_distributions();
    const entrypoints = [];

    for (const entry of packages) {
      if (packages[entry].valueOf().includes(name)) {
        entrypoints.push(entry.valueOf());
      }
    }

    if (entrypoints.length === 0) {
      throw new TypeError(
        `Failed to import module ${module}, could not find import name ${name}`,
      );
    }

    entrypoint = entrypoints[0];

    if (entrypoints.length > 1) {
      if (entrypoints.includes(name)) {
        entrypoint = entrypoints[entrypoints.indexOf(name)];
      } else {
        console.warn(
          `${
            yellow(
              "Warning",
            )
          } could not determine a single entrypoint for module ${module}, please specify one of: ${
            entrypoints.join(
              ", ",
            )
          }. Importing ${entrypoint}`,
        );
      }
    }

    return python.import(entrypoint!);
  }
}

export const pip = new Pip();
export default pip;
