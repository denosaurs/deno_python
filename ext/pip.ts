import { kw, python, PythonError } from "../mod.ts";

import { join } from "https://deno.land/std@0.195.0/path/mod.ts";

import type { CacheLocation } from "https://deno.land/x/plug@1.0.2/types.ts";
import { ensureCacheLocation } from "https://deno.land/x/plug@1.0.2/download.ts";
import { hash } from "https://deno.land/x/plug@1.0.2/util.ts";
import { green } from "https://deno.land/std@0.195.0/fmt/colors.ts";

const sys = python.import("sys");
const runpy = python.import("runpy");
const importlib = python.import("importlib.metadata");

const MODULE_NAME_REGEX =
  /^([a-z0-9]|[a-z0-9][a-z0-9._-]*[a-z0-9])(?:[^a-z0-9]+.*)$/i;

function normalizeModule(name: string) {
  return name.replaceAll(/[-_.]+/g, "-").toLowerCase();
}

/**
 * Install a Python module using the `pip` package manager into a specified or
 * default cache location, adding that location to the python path if it is not
 * already registered.
 *
 * @param module The Python module which you wish to install
 * @param location The cache location where you want to install it
 *
 * @example
 * ```ts
 * import { python } from "https://deno.land/x/python/mod.ts";
 * import { install } from "https://deno.land/x/python/ext/pip.ts";
 *
 * await install("fuckit");
 * const fuckit = python.import("fuckit");
 *
 * ```
 */
export async function install(module: string, location?: CacheLocation) {
  const cacheLocation = join(
    await ensureCacheLocation(location),
    globalThis.location !== undefined
      ? await hash(globalThis.location.href)
      : "python",
  );

  if (!(cacheLocation in sys.path)) {
    sys.path.insert(0, cacheLocation);
  }

  const argv = sys.argv;
  sys.argv = ["pip", "install", "-q", "-t", cacheLocation, module];
  console.log(`${green("Installing")} ${module}`);

  try {
    runpy.run_module("pip", kw`run_name=${"__main__"}`);
  } catch (error) {
    if (
      !(error instanceof PythonError &&
        error.type.isInstance(python.builtins.SystemExit()) &&
        error.value.asLong() === 0)
    ) {
      throw error;
    }
  } finally {
    sys.argv = argv;
  }
}

export const pip = {
  install,
  /**
   * Install and import a Python module using the `pip` package manager into a
   * specified or default cache location, adding that location to the python
   * path if it is not already registered.
   *
   * @param module The Python module which you wish to install
   * @param location The cache location where you want to install it
   *
   * @example
   * ```ts
   * import { python } from "https://deno.land/x/python/mod.ts";
   * import { pip } from "https://deno.land/x/python/ext/pip.ts";
   *
   * const fuckit = await pip.import("fuckit==4.8.1");
   *
   * ```
   */
  import: async (module: string, location?: CacheLocation) => {
    await install(module, location);
    const name = normalizeModule(
      module.match(MODULE_NAME_REGEX)?.[1] ?? module,
    );
    const packages = importlib.packages_distributions();
    for (const entry of packages) {
      if (packages[entry].valueOf().includes(name)) {
        return python.import(entry);
      }
    }
    throw new TypeError(
      `Failed to import module ${module}, could not find import name`,
    );
  },
};

export default pip;
